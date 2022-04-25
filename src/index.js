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
    url: "https://www.navyfederal.org/loans-cards/mortgage/mortgage-rates/conventional-fixed-rate-mortgages.html",
  };

  if (!input || !input.url)
    throw new Error('Input must be a JSON object with the "url" field!');
  try {
    log.info("Launching Puppeteer...");
    // console.log("Launching Puppeteer...");
    const browser = await Apify.launchPuppeteer();
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

      console.log("Getting interest rates...");
      let term;
      let interestRate;
      let discountPoints;
      let apr;
      let obj = {};

      const interestRatesTable = await page.$(".table-resp");

      // example output:
      // [
      //    'Term\tInterest Rates As Low As\tDiscount Points\tAPR As Low As',
      //    '15 Year\t2.500%\t0.750\t2.751%',
      //    '15 Year Jumbo\t2.500%\t0.750\t2.751%',
      //    '30 Year\t3.125%\t1.125\t3.295%',
      //    '30 Year Jumbo\t3.000%\t1.125\t3.169%'
      // ]
      const conventional30yrRate = await interestRatesTable.$$eval(
        "tr",
        (trs) => {
          let obj = {};

          // tr is a table row in the interest rates table. we want to extract
          // the interest rate for the row that starts with 30 year. Each
          // table row itself has children. The first of which is a table header
          // indicating the term of the loan, ie, 30 Year.
          for (tr of trs) {
            // tr.children looks like: [th, td, td, td]
            let children = tr.children;

            // remember we're mapping, which means we'll hit this once for each of the rows
            // we want to iterate through the table row's elements, aka children, until we find the one
            // with the string 30 Year
            for (const child of children) {
              // remember child will be a th or td (see tr.children above)
              // each child will have a firstChild. and its data looks like the below.
              // for th, it looks like: "30 Year "
              // for td, it looks like: "3.125"
              // for 2nd td, it looks like: "1.125"
              // for 3rd td, it looks like: "3.295"
              if (
                child.firstChild.textContent &&
                child.firstChild.textContent.endsWith("30 Year ")
              ) {
                // we're in the right row, extract data
                // table heading, th
                // e.g., 30 Year

                obj.term = children[0].innerText;
                // 1st table data, td
                // e.g., 3.125
                obj.interestRate = children[1].innerText;
                // 2nd table data, td
                // e.g., 1.125
                obj.discountPoints = children[2].innerText;
                // 3rd table data, td
                // e.g., 3.295
                obj.apr = children[3].innerText;
              }
            }
          }

          obj.date = String(
            new Date().toLocaleString("en-US", { timezone: "America/Chicago" })
          );

          return obj;
        }
      );

      console.log(conventional30yrRate);

      await Apify.pushData(conventional30yrRate);
      await Apify.setValue("term", conventional30yrRate.term);
      await Apify.setValue("interestRate", conventional30yrRate.interestRate);
      await Apify.setValue(
        "discountPoints",
        conventional30yrRate.discountPoints
      );
      await Apify.setValue("apr", conventional30yrRate.apr);
      await Apify.setValue("date", conventional30yrRate.date);
    } catch (error) {
      console.log("browser or other error:");
      console.log(error);
    } finally {
      console.log("Closing Puppeteer...");
      await browser.close();

      console.log("Done.");
    }
  } catch (e) {
    console.log("Launch Puppeteer error:");
    console.log(e);
  }
});
