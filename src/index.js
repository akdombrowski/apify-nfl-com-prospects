// This is the main Node.js source code file of your actor.
// It is referenced from the "scripts" section of the package.json file,
// so that it can be started by running "npm start".

// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require("apify");
const { log } = Apify.utils;

Apify.main(async () => {
  // Get input of the actor (here only for demonstration purposes).
  // If you'd like to have your input checked and have Apify display
  // a user interface for it, add INPUT_SCHEMA.json file to your actor.
  // For more information, see https://docs.apify.com/actors/development/input-schema
  const input = {
    url: "https://www.nfl.com/prospects/participants/all/",
  };

  if (!input || !input.url)
    throw new Error('Input must be a JSON object with the "url" field!');
  try {
    const launchContext = {
      // Native Puppeteer options
      launchOptions: {
        //     headless: true,
        //     args: ["--some-flag"],
        timeout: 60000,
        ignoreDefaultArgs: ["--disable-extensions"],
      },
    };
    log.info("Launching Puppeteer...");
    // console.log("Launching Puppeteer...");
    const browser = await Apify.launchPuppeteer(launchContext);
    try {
      console.log(`Opening page ${input.url}...`);
      const page = await browser.newPage();
      page.on("console", async (msg) => {
        const msgArgs = msg.args();
        for (let i = 0; i < msgArgs.length; ++i) {
          console.log(await msgArgs[i].jsonValue());
        }
      });
      await page.goto(input.url);

      const title = await page.title();
      console.log(`Title of the page "${input.url}" is "${title}".`);

      console.log("Saving output...");
      await Apify.setValue("title", {
        title,
      });

      console.log("Getting nfl draft prospects...");

      // wait for "loadedContent" which contains player list
      // document.querySelector("#main-content > section:nth-child(3) > div > div > div > div > div > div.loadedContent")
      //
      console.log("Waiting for content to load...");
      await page.waitForXPath(
        "//body[1]/div[3]/main[1]/section[2]/div[1]/div[1]/div[1]/div[1]/div[1]/div[3]/div[1]/div[1]/div[1]"
      );

      // load loadedContent node first and use that as a relative root
      const loadedContent = await page.$(".loadedContent");
      const playerInfoBlockArr = await loadedContent.$x("./div/div/div/div");
      const playerInfoBlock = playerInfoBlockArr[0];
      const players = await playerInfoBlock.$x("child::div");
      const playerLinks = await playerInfoBlock.$x(".//a");

      console.log("Number of players:");
      console.log(players.length);
      console.log("Number of playerLinks:");
      console.log(playerLinks.length);

      const links = [];
      for (const elementHandle of playerLinks) {
        const href = await elementHandle.evaluate((node) => node.href);
        const threeThingsContainer = await elementHandle.$x(
          "./div/div/div/div/div/div"
        );
        links.push(href);
        const theThreeThings = await threeThingsContainer[0].$x("./div");
        const imgNode = theThreeThings[0];
        const nameDetailsNode = theThreeThings[1];
        const scoreNode = theThreeThings[2];

        //
        // image handling, left container
        //
        const imgArr = await imgNode.$x(".//img");
        const imgLink = await imgArr[0].evaluate((node) => node.src);

        //
        // name, year, position, team handling
        //
        // break the middle container down into: 1) name and year 2) position and team.
        const nameYearPositionTeamContainer = await nameDetailsNode.$x("./div");
        const nameYear = nameYearPositionTeamContainer[0];
        const positionTeam = nameYearPositionTeamContainer[1];

        // split name and year to get each value
        const nameYearArr = await nameYear.$x("./div");
        const nameNode = nameYearArr[0];
        const yearNode = nameYearArr[1];
        const name = await nameNode.evaluate((node) => node.innerText);
        const year = await yearNode.evaluate((node) => node.innerText);

        await Apify.pushData({name: name, img: img, year: year})
      }

      // await Apify.pushData(conventional30yrRate);
      // await Apify.setValue("term", conventional30yrRate.term);
      // await Apify.setValue("interestRate", conventional30yrRate.interestRate);
      // await Apify.setValue(
      //   "discountPoints",
      //   conventional30yrRate.discountPoints
      // );
      // await Apify.setValue("apr", conventional30yrRate.apr);
      // await Apify.setValue("date", conventional30yrRate.date);
    } catch (error) {
      console.log("browser or other error:");
      log.error("browser or other error:");
      console.log(error);
      log.error(error);
    } finally {
      console.log("Closing Puppeteer...");
      log.info("Closing Puppeteer...");

      await browser.close();

      console.log("Done.");
      log.info("Done.");
    }
  } catch (e) {
    console.log("Launch Puppeteer error:");
    console.log(e);
  }
});
