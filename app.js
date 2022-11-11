require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const server = express();
const cors = require("cors");
const xrpl = require("xrpl");
const fs = require("fs");
server.use(bodyParser.json()); // for parsing server application/json
server.use(bodyParser.urlencoded({ extended: true })); // for parsing serverlication/x-www-form-urlencoded
server.use(
  cors({
    origin: "165.232.173.55",
  })
);
server.listen(80, () => {
  console.log("Server Listening");
});

server.post("/", async (req, res) => {
  if (req.body.address) {
    try {
      const address = req.body.address;
      const redeemObj = await getRedeemObj(address);
      res.send(redeemObj);
    } catch (err) {
      res.status(400).send(err);
    }
  } else {
    res.status(400).send("Address missing");
  }
});
server.use((err, req, res, next) => {
  next();
});
async function getRedeemObj(address) {
  const client = await getXrplClient();
  if (
    process.env.TOKEN_HEX.toLowerCase() == "xrp" &&
    process.env.TOKEN_ISSUER.toLowerCase() == "xrp"
  ) {
    var amount = (Number(process.env.TOKEN_AMOUNT) * 1000000).toString();
  } else {
    var amount = {
      currency: process.env.TOKEN_HEX,
      issuer: process.env.TOKEN_ISSUER,
      value: process.env.TOKEN_AMOUNT,
    };
  }
  //wallet of issuer
  var nftWallet = xrpl.Wallet.fromSeed(process.env.ISSUER_SEED);

  var count = 0;
  while (count < 5) {
      try {

          //GET NFTS
          var nftsToCollect = 2000
          var nftSelection = []
          var marker = "begin"
          while (marker != null && nftSelection.length < nftsToCollect) {

              var request = {
                  "command": "account_nfts",
                  "ledger_index": "validated",
                  "account": nftWallet.classicAddress,
                  "limit": 400
              }

              if (marker != "begin") request.marker = marker

              var result = await client.request(request)
              var nftSelection = nftSelection.concat(result.result.account_nfts)
              var marker = result.result.marker
          }

          //CHECK FILE EXISTS
          if (!(fs.existsSync('wallets.json'))) fs.writeFileSync('wallets.json', (JSON.stringify({}, null, 2)))

          //READ FILE
          var wallets = JSON.parse(fs.readFileSync('wallets.json'))

          //CHECK ADDRESS EXISTS IN FILE, IF NOT ADD IT
          if (!(address in wallets)) {
              wallets[address] = {
                  "nft": undefined,
                  "date": 0
              }
          }

          //CHECK IF THE NFT ASSIGNED TO THE WALLET STILL EXISTS
          var nftExists = false
          for (a in nftSelection) { //CYCLE THROUGH HELD NFTS
              if (nftSelection[a].NFTokenID == wallets[address].nft) { //CHECK FOR TOKEN ID TO MATCH
                  if (wallets[address].date + (10 * 86400000) > Date.now()) { //CHECK THE NFT ASSIGNMENT ISN'T OLDER THAN 10 DAYS
                      var nftExists = true
                  }
              }
          }

          if (nftExists) { //IF NFT EXISTS
              console.log(`${address} -> NFT ALREADY ASSIGNED`)
              var nftToSell = wallets[address].nft //SET OLD NFT TO SELL
              wallets[address].date = Date.now() //RESET 10 DAY TIMER

          } else { //IF DOESN'T EXIST
              console.log(`${address} -> nft not assigned`)

              console.log(`Checking NFT not claimed`)
              var count = 0
              var assignedToOtherWallet = true
              while(assignedToOtherWallet){
                  var nftCheck = nftSelection[Math.floor(Math.random() * (nftSelection.length - 1 - 0 + 1) + 0)].NFTokenID; //CHOOSE RANDOM NFT

                  //CHECK NOT ASSIGNED TO OTHER USER
                  var assignedToOtherWallet = false
                  var addresses = Object.keys(wallets)
                  for(a in addresses){

                      if(wallets[addresses[a]].date + (10 * 86400000) < Date.now()){ //IF WALLET HAS EXPIRED REMOVE IT TO KEEP JSON SMALL
                          delete wallets[addresses[a]]
                          continue
                      }

                      if(assignedToOtherWallet) continue //DO THIS TO PREVENT EXCESS LOOPING

                      if(nftCheck == wallets[addresses[a]].nft) var assignedToOtherWallet = true //IF ASSIGNED
                  }

                  count ++
                  if(count >= 500) break
              }
              console.log(`\tRandomised ${count} times`)

              var nftToSell = nftCheck

              //SET VARIABLES IN JSON
              wallets[address] = {
                  "nft": nftToSell,
                  "date": Date.now()
              }
          }

          //SAVE UPDATED JSON
          fs.writeFileSync('wallets.json', (JSON.stringify(wallets, null, 0)))

          var nftID = nftToSell
          console.log(`\tSelling ${nftID}`);
          break;
      } catch (err) {
          console.log(err)
          count += 1;
          if (count == 4) {
            throw err
          }
      }
  }

  //If could no select NFT in 5 attempts
  if (nftID == undefined) throw "Could Not Select NFT";

  //console.log(`\tRandom NFT selected -> NFTokenID: ${nftID}`)
  //set expiry of offer 5 minutes from now
  var expiry = +(Date.now() / 1000 - 946684800 + 300).toString().split(".")[0];

  //mint NFT
  //Try Place mint up to 5 times
  //console.log(`\nSetting Sell Order For Chosen NFT`)
  var count = 0;
  while (count < 5) {
    try {
      var nftSellPrep = await client.autofill({
        TransactionType: "NFTokenCreateOffer",
        Account: nftWallet.classicAddress,
        NFTokenID: nftID,
        Amount: amount,
        Flags: 1,
        Destination: address,
        Expiration: expiry,
      });

      nftSellPrep.LastLedgerSequence -= 15;

      var nftSellSigned = nftWallet.sign(nftSellPrep);
      var nftSellResult = await client.submitAndWait(nftSellSigned.tx_blob);

      if (nftSellResult.result.meta.TransactionResult == "tesSUCCESS") {
        for (a in nftSellResult.result.meta.AffectedNodes) {
          if ("CreatedNode" in nftSellResult.result.meta.AffectedNodes[a]) {
            if (
              nftSellResult.result.meta.AffectedNodes[a].CreatedNode
                .LedgerEntryType == "NFTokenOffer"
            ) {
              var nftOfferIndex =
                nftSellResult.result.meta.AffectedNodes[a].CreatedNode
                  .LedgerIndex;
            }
          }
        }
      } else {
        fakeFunctionToThrowError();
      }
      break;
    } catch (err) {
      //console.log(`                    Failed ${count}`)
      count += 1;
    }
  }

  //if could not sell NFT
  if (nftOfferIndex == undefined) throw "Could Not Place order";

  //console.log(`\tOffer Index: ${nftOfferIndex}`)

  //this object will be used in the Xumm object
  //this allows to generate a relevant Xumm qrCode
  var xummObj = {
    TransactionType: "NFTokenAcceptOffer",
    NFTokenSellOffer: nftOfferIndex,
  };
  const objectReturn = [xummObj, nftID];
  return objectReturn;
}
async function getXrplClient() {
  //define
  var client = new xrpl.Client("wss://xrplcluster.com/");

  //console.log("Connecting to XRPL")
  //Try Connect to XRPL
  var count = 0;
  while (count < 6) {
    if (count >= 3) {
      var client = new xrpl.Client("wss://s2.ripple.com/");
    }

    try {
      await client.connect();
      // console.log(`\tConnected`);
      break;
    } catch (err) {
      //console.log(`                    Failed ${count}`)
      count += 1;
    }
  }
  return client;
}
