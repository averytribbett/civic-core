import assert from "node:assert/strict"
import test from "node:test"
import { load } from "cheerio"
import { TextProcessingService } from "../src/services/text-processing.service"

test("extractHtmlStructured finds CivicPlus #pageContent", () => {
  const $ = load(`
    <html><head><title>County</title></head>
    <body><div id="pageContent"><h1>Services</h1><p>Permit info here.</p></div></body>
    </html>
  `)
  const svc = new TextProcessingService()
  const result = svc.extractHtmlStructured($)
  assert.ok(result)
  assert.match(result!.text, /Permit info/)
})

test("extractHtmlStructured finds OpenCities #main / #main-content", () => {
  const $ = load(`
    <html><head><title>Home - City and County of Denver</title></head>
    <body>
      <div id="main" role="main">
        <div id="main-content"><h1>Top Services</h1><p>Pay a parking ticket online.</p></div>
      </div>
    </body>
    </html>
  `)
  const svc = new TextProcessingService()
  const structured = svc.extractHtmlStructured($)
  assert.ok(structured)
  assert.match(structured!.text, /parking ticket/)
  assert.equal(svc.extractHtmlText($).includes("parking ticket"), true)
})

test("extractHtmlText keeps OpenCities content inside aria-hidden wrappers", () => {
  const $ = load(`
    <html><body>
      <div id="main-content">
        <div aria-hidden="true"><p>Permit office hours are 8am to 4pm.</p></div>
      </div>
    </body></html>
  `)
  const svc = new TextProcessingService()
  assert.match(svc.extractHtmlText($), /Permit office hours/)
})
