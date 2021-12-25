const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(helmet());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// create Player object
function craftPlayer(id, page, price, level, se, contract) {
  return {
    id: id,
    page: page,
    price: price,
    level: level,
    se: se,
    contract: contract,
  };
}

// create Bus object
function craftBus(id, page, price, level, capacity) {
  return {
    id: id,
    page: page,
    price: price,
    level: level,
    capacity: capacity,
  };
}

// filter exceptional case
function cleanObject(o, index) {
  if (o.nft.metadata == null || o.nft.metadata.attributes == null) {
    return "no value";
  }
  return o.nft.metadata.attributes[index].value;
}

// write to file
function writeToFile(c, i) {
  fs.writeFileSync("debug-" + i + ".txt", c, { flag: "a+" }, (err) => {});
}

// crawl data from the specified page
async function crawlSquidPage(id, p) {
  const url = "https://marketplace.biswap.org/back/offers/main-page";
  const res = await fetch(url + "?sortBy=acs&userAddress=no-address&page=" + p + "&partner=" + id + "&filter=none");
  const data = await res.json();
  return data.data.map((o) => ({ ...o, page: p + 1 }));
}

// get the total page count of specified object
async function getCounter(id) {
  const url = "https://marketplace.biswap.org/back/offers/main-page";
  const res = await fetch(url + "?sortBy=acs&userAddress=no-address&page=0&partner=" + id + "&filter=none");
  const data = await res.json();
  return data.counter;
}

// aggregate & filter Player data
async function concatPlayerData(se) {
  const squidPlayerId = "61be229e6b84d59feeb0366c";
  let c = await getCounter(squidPlayerId);
  let pages = [...Array(c).keys()];
  let responses = await Promise.all(pages.map((p) => crawlSquidPage(squidPlayerId, p)));
  let res = responses.flat().map((o) => {
    return craftPlayer(o.nft_id, o.page, o.usdPrice.toFixed(2) + "U", cleanObject(o, 0), cleanObject(o, 1), cleanObject(o, 2));
  });
  return res.filter((p) => p.se.split("/")[0] > se);
}

// aggregate & filter Bus data
async function concatBusData(capacity) {
  const squidBusId = "61be22926b84d59feeb0366b";
  let c = await getCounter(squidBusId);
  let pages = [...Array(c).keys()];
  let responses = await Promise.all(pages.map((p) => crawlSquidPage(squidBusId, p)));
  let res = responses.flat().map((o) => {
    return craftBus(o.nft_id, o.page, o.usdPrice.toFixed(2) + "U", cleanObject(o, 0), cleanObject(o, 1));
  });
  return res.filter((b) => b.capacity > capacity);
}

(async () => {
  app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "main.html"));
  });

  app.get("/player", async function (req, res) {
    let e = req.query.se;
    if (e == "" || e == null) {
      e = 0;
    }
    try {
      let data = await concatPlayerData(e);
      res.send(data);
    } catch (err) {
      res.status(500).end(err);
    }
  });

  app.get("/bus", async function (req, res) {
    let c = req.query.capacity;
    if (c == "" || c == null) {
      c = 0;
    }
    try {
      let data = await concatBusData(c);
      res.send(data);
    } catch (err) {
      res.status(500).end(err);
    }
  });

  app.listen(process.env.PORT || 8000, function () {
    console.log("Server is listening on port 8000");
  });
})();
