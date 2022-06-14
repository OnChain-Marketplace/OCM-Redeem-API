require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const server = express();
const cors = require("cors");
const xrpl = require("xrpl");
const { XummSdk } = require("xumm-sdk");
const sdk = new XummSdk(process.env.XUMM_ACCESS, process.env.XUMM_SECRET);
server.use(bodyParser.json()); // for parsing server application/json
server.use(bodyParser.urlencoded({ extended: true })); // for parsing serverlication/x-www-form-urlencoded
server.use(
  cors({
    origin: "165.232.173.55",
  })
);
server.listen(3000, () => {
  console.log("Server Listening");
});

server.post("/", async (req, res) => {
  if (req.body.address && req.body.mobile && req.body.mobile) {
    try {
      const address = req.body.address;
      const mobile = req.body.mobile;
      const return_url = req.body.return_url;
      const payload = await getPayload(address, mobile, return_url);
      res.send(payload);
    } catch (err) {
      res.send(req.body);
      //   res.status(400).send("Error: " + err);
    }
  } else {
    res.send(req.body);
    // res.status(400).send("Parameters missing");
  }
});
async function getPayload(address, mobile, return_url) {
  const client = await getXrplClient();
  try {
    //wallet of issuer
    var nftWallet = xrpl.Wallet.fromSeed(process.env.ISSUER_SEED);

    //console.log(`\nScanning NFTs held by ${nftWallet.classicAddress}`)
    //Try Select an NFT up to 5 times
    var count = 0;
    while (count < 5) {
      try {
        var accountNFTs = await client.request({
          method: "account_nfts",
          ledger_index: "validated",
          account: nftWallet.classicAddress,
          limit: 400,
        });

        var nftSelection = accountNFTs.result.account_nfts;
        var nftID =
          nftSelection[
            Math.floor(Math.random() * (nftSelection.length - 1 - 0 + 1) + 0)
          ].NFTokenID;
        break;
      } catch (err) {
        //console.log(`                    Failed ${count}`)
        count += 1;
      }
    }

    //If could no select NFT in 5 attempts
    if (nftID == undefined) {
      //console.log('Could Not Select NFT')
      return;
    }

    //console.log(`\tRandom NFT selected -> NFTokenID: ${nftID}`);
    //set expiry of offer 5 minutes from now
    var expiry = +(Date.now() / 1000 - 946684800 + 300)
      .toString()
      .split(".")[0];

    //mint NFT
    //Try Place mint up to 5 times
    //console.log(`\nSetting Sell Or or Chosen NFT`);
    var count = 0;
    while (count < 5) {
      try {
        var nftSellPrep = await client.autofill({
          TransactionType: "NFTokenCreateOffer",
          Account: nftWallet.classicAddress,
          NFTokenID: nftID,
          Amount: "10000000",
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
          throw "Error wth acc";
        }
        break;
      } catch (err) {
        console.log(err);
        //console.log(`                    Failed ${count}`)
        count += 1;
      }
    }

    //if could not sell NFT
    if (nftOfferIndex == undefined) {
      //console.log('Could Not Place order')
      return;
    }

    //console.log(`\tOffer Index: ${nftOfferIndex}`)

    //this object will be used in the Xumm object
    //this allows to generate a relevant Xumm qrCode
    const request = {
      options: {
        submit: true,
        expire: 240,
      },
      txjson: {
        TransactionType: "NFTokenAcceptOffer",
        NFTokenSellOffer: nftOfferIndex,
      },
    };
    if (mobile) {
      request.options["return_url"] = {
        app: return_url,
      };
    } else
      request.options["return_url"] = {
        web: return_url,
      };
    const payload = sdk.payload.create(request);

    return payload;
  } catch (error) {
    return;
  } finally {
    await client.disconnect();
  }
}

async function getXrplClient() {
  //define
  var client = new xrpl.Client("wss://xls20-sandbox.rippletest.net:51233");

  //console.log("Connecting to XRPL")
  //Try Connect to XRPL
  var count = 0;
  while (count < 6) {
    if (count >= 3) {
      var client = new xrpl.Client("wss://xls20-sandbox.rippletest.net:51233");
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
