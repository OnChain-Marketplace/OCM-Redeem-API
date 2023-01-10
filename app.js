require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const server = express();
const cors = require("cors");
const xrpl = require("xrpl");
const fs = require("fs");
server.use(bodyParser.json()); // for parsing server application/json
server.use(bodyParser.urlencoded({
    extended: true
})); // for parsing serverlication/x-www-form-urlencoded
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
            const UUID = req.body.UUID;
            const DID = req.body.DID;
            const redeemObj = await getRedeemObj(address, UUID, DID);
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
async function getRedeemObj(address, id, id2) {
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
            if (!(fs.existsSync(__dirname + '/wallets.json'))) fs.writeFileSync(__dirname + '/wallets.json', (JSON.stringify({}, null, 2)))
            if (!(fs.existsSync(__dirname + '/wallets2.json'))) fs.writeFileSync(__dirname + '/wallets2.json', (JSON.stringify({}, null, 2)))
            if (!(fs.existsSync(__dirname + '/wallets3.json'))) fs.writeFileSync(__dirname + '/wallets3.json', (JSON.stringify({}, null, 2)))

            //READ FILE
            var wallets = JSON.parse(fs.readFileSync(__dirname + '/wallets.json'))
            var wallets2 = JSON.parse(fs.readFileSync(__dirname + '/wallets2.json'))
            var wallets3 = JSON.parse(fs.readFileSync(__dirname + '/wallets3.json'))

            //CHECK IF THERE IS EXISTING DATA WITH OLD METHOD
            if (address in wallets && !(id in wallets)) {
                wallets[id] = wallets[address]
                delete wallets[address]
            }

            //CHECK ID EXISTS IN FILE, IF NOT ADD IT
            if (!(id in wallets)) {
                wallets[id] = {
                    "nft": undefined,
                    "date": 0
                }
            }

            if (!(address in wallets2)) {
                wallets2[address] = {
                    "nft": undefined,
                    "date": 0
                }
            }

            if (!(id2 in wallets3)) {
                wallets3[id2] = {
                    "nft": undefined,
                    "date": 0
                }
            }

            //CHECK IF THE NFT ASSIGNED TO THE ID STILL EXISTS
            var nftExists = false
            for (a in nftSelection) { //CYCLE THROUGH HELD NFTS
                if (nftSelection[a].NFTokenID == wallets[id].nft) { //CHECK FOR TOKEN ID TO MATCH
                    if (wallets[id].date + (10 * 86400000) > Date.now()) { //CHECK THE NFT ASSIGNMENT ISN'T OLDER THAN 10 DAYS
                        var nftExists = true
                    }
                }
            }

            if (nftExists) { //IF NFT EXISTS
                console.log(`${address} -> NFT ALREADY ASSIGNED`)
                var nftToSell = wallets[id].nft //SET OLD NFT TO SELL
                wallets[id].date = Date.now() //RESET 10 DAY TIMER

                //UPDATE WALLETS2
                wallets2[address].nft = nftToSell
                wallets2[address].date = Date.now()

                wallets3[id2].nft = nftToSell
                wallets3[id2].date = Date.now()

            } else { //IF DOESN'T EXIST
                console.log(`${address} -> nft not assigned by id`)
                var nftExists = false
                for (a in nftSelection) { //CYCLE THROUGH HELD NFTS
                    if (nftSelection[a].NFTokenID == wallets2[address].nft) { //CHECK FOR TOKEN ID TO MATCH
                        if (wallets2[address].date + (10 * 86400000) > Date.now()) { //CHECK THE NFT ASSIGNMENT ISN'T OLDER THAN 10 DAYS
                            var nftExists = true
                        }
                    }
                }

                if (nftExists) { //IF NFT EXISTS
                    console.log(`${address} -> NFT ALREADY ASSIGNED BY ADD`)
                    var nftToSell = wallets2[address].nft //SET OLD NFT TO SELL
                    wallets2[address].date = Date.now() //RESET 10 DAY TIMER

                    //UPDATE WALLETS2
                    wallets[id].nft = nftToSell
                    wallets[id].date = Date.now()

                    wallets3[id2].nft = nftToSell
                    wallets3[id2].date = Date.now()

                } else {

                    console.log(`${address} -> nft not assigned by id or add`)
                    var nftExists = false
                    for (a in nftSelection) { //CYCLE THROUGH HELD NFTS
                        if (nftSelection[a].NFTokenID == wallets3[id2].nft) { //CHECK FOR TOKEN ID TO MATCH
                            if (wallets3[id2].date + (10 * 86400000) > Date.now()) { //CHECK THE NFT ASSIGNMENT ISN'T OLDER THAN 10 DAYS
                                var nftExists = true
                            }
                        }
                    }

                    if (nftExists) { //IF NFT EXISTS
                        console.log(`${address} -> NFT ALREADY ASSIGNED BY ID2`)
                        var nftToSell = wallets3[id2].nft //SET OLD NFT TO SELL
                        wallets3[id2].date = Date.now() //RESET 10 DAY TIMER

                        //UPDATE WALLETS2
                        wallets[id].nft = nftToSell
                        wallets[id].date = Date.now()

                        wallets2[address].nft = nftToSell
                        wallets2[address].date = Date.now()

                    } else {
                        console.log(`${address} -> nft not assigned in any circumstance`)

                        var count = 0
                        var assignedToOtherWallet = true
                        var assignedToOtherWallet2 = true
                        var assignedToOtherWallet3 = true
                        while (assignedToOtherWallet || assignedToOtherWallet2 || assignedToOtherWallet3) {
                            var nftCheck = nftSelection[Math.floor(Math.random() * (nftSelection.length - 1 - 0 + 1) + 0)].NFTokenID; //CHOOSE RANDOM NFT

                            //CHECK NOT ASSIGNED TO OTHER USER
                            var assignedToOtherWallet = false
                            var addresses = Object.keys(wallets)
                            for (a in addresses) {

                                if (wallets[addresses[a]].date + (10 * 86400000) < Date.now()) { //IF WALLET HAS EXPIRED REMOVE IT TO KEEP JSON SMALL
                                    delete wallets[addresses[a]]
                                    continue
                                }

                                if (assignedToOtherWallet) continue //DO THIS TO PREVENT EXCESS LOOPING

                                if (nftCheck == wallets[addresses[a]].nft) var assignedToOtherWallet = true //IF ASSIGNED
                            }

                            if (!assignedToOtherWallet) { //IF NOT ASSIGNED, CHECK SECOND OPTION
                                var assignedToOtherWallet2 = false
                                var addresses = Object.keys(wallets2)
                                for (a in addresses) {

                                    if (wallets2[addresses[a]].date + (10 * 86400000) < Date.now()) { //IF WALLET HAS EXPIRED REMOVE IT TO KEEP JSON SMALL
                                        delete wallets2[addresses[a]]
                                        continue
                                    }

                                    if (assignedToOtherWallet2) continue //DO THIS TO PREVENT EXCESS LOOPING

                                    if (nftCheck == wallets2[addresses[a]].nft) var assignedToOtherWallet2 = true //IF ASSIGNED
                                }
                            }

                            if (!assignedToOtherWallet && !assignedToOtherWallet2) { //IF NOT ASSIGNED, CHECK THIRD OPTION
                                var assignedToOtherWallet3 = false
                                var addresses = Object.keys(wallets3)
                                for (a in addresses) {

                                    if (wallets3[addresses[a]].date + (10 * 86400000) < Date.now()) { //IF WALLET HAS EXPIRED REMOVE IT TO KEEP JSON SMALL
                                        delete wallets3[addresses[a]]
                                        continue
                                    }

                                    if (assignedToOtherWallet3) continue //DO THIS TO PREVENT EXCESS LOOPING

                                    if (nftCheck == wallets3[addresses[a]].nft) var assignedToOtherWallet3 = true //IF ASSIGNED
                                }
                            }

                            count++
                            if (count >= 1500) break
                        }
                        console.log(`\tRandomised ${count} times`)

                        var nftToSell = nftCheck

                        //SET VARIABLES IN JSON
                        wallets[id] = {
                            "nft": nftToSell,
                            "date": Date.now()
                        }
                        wallets2[address] = {
                            "nft": nftToSell,
                            "date": Date.now()
                        }
                        wallets3[id2] = {
                            "nft": nftToSell,
                            "date": Date.now()
                        }
                    }
                }
            }

            //SAVE UPDATED JSON
            fs.writeFileSync(__dirname + '/wallets.json', (JSON.stringify(wallets, null, 0)))
            fs.writeFileSync(__dirname + '/wallets2.json', (JSON.stringify(wallets2, null, 0)))
            fs.writeFileSync(__dirname + '/wallets3.json', (JSON.stringify(wallets3, null, 0)))

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