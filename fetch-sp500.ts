import fs from 'fs';

async function main() {
  try {
    console.log("Fetching Wikipedia S&P 500 page...");
    const res = await fetch('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies');
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const text = await res.text();
    
    // Locate the constituents table in Wikipedia HTML
    const tableMatch = text.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/);
    if (!tableMatch) {
      console.error("S&P 500 table not found.");
      return;
    }
    
    const tableHtml = tableMatch[1];
    const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
    const tickers: string[] = [];
    
    // The first column in each row (td) usually contains the ticker symbol.
    // e.g., <td><a href="..." class="...">AAPL</a></td> or <td>AAPL</td>
    for (const row of rows) {
      // Find the first <td> in the row
      const tdMatch = row.match(/<td>([\s\S]*?)<\/td>/);
      if (tdMatch) {
        let ticker = tdMatch[1].trim();
        // Clean up links and inner elements
        ticker = ticker.replace(/<[^>]*>/g, '').trim();
        // Clean up: make uppercase and remove non-letters/numbers (replace . or - appropriately for financial sites)
        ticker = ticker.toUpperCase().replace(/[^A-Z0-9\.\-]/g, '').trim();
        // Standardize class share ticker dots to hyphens if necessary (Wikipedia often uses dots e.g. BRK.B or BF.B, slickcharts / yahoo usually uses BRK-B or BF-B, or BRK.B)
        // Let's keep it clean
        if (ticker && ticker.length >= 1 && ticker.length <= 7) {
          tickers.push(ticker);
        }
      }
    }
    
    console.log(`Successfully extracted ${tickers.length} S&P 500 tickers.`);
    fs.writeFileSync('sp500_tickers.json', JSON.stringify(tickers, null, 2));
  } catch (err) {
    console.error("Error fetching S&P 500 tickers:", err);
  }
}

main();
