import "./style.css";
import * as d3 from "d3";

const width = 1000;
const margin = { left: 5, top: 5, right: 5, bottom: 5 };
const svg = d3.select("svg#chart");

// setup callbacks for pressing enter on the text input and clicking submit
const textInput = d3.select("input#query").on("keydown", (event) => {
  if (event.key === "Enter") update();
});
d3.select("input#submit").on("click", () => update());

const chart = svg.append("g");
const heightPerBar = 32;
const x = d3.scaleLinear().range([margin.left, width - margin.right]);
const y = d3.scaleBand().paddingOuter(0).paddingInner(0.05);

async function fetchAspects(query) {
  const url = `https://www.args.me/api/v2/aspectSpace?query=${query}&format=json`;
  const response = await fetch(url);
  return await response.json();
}

async function fetchArguments(query, numItems = 10) {
  const url = `https://www.args.me/api/v2/arguments?query=${query}&pageSize=${numItems}&format=json`;
  const response = await fetch(url);
  return await response.json();
}

async function update() {
  // get the query terms from the text input
  const query = textInput.property("value");

  if (!query) return; // nothing to show for an empty query

  fetchAspects(query).then((data) => updateBarchart(data));
  fetchArguments(query).then((data) => updateTable(data));
}

function updateBarchart(data) {
  // compute the height of the visualization dynamically
  const height = heightPerBar * data.dimensions.length;
  svg.attr("viewBox", [0, 0, width, height]);

  // update the scales
  x.domain([0, d3.max(data.dimensions, (d) => d.weight)]);
  y.domain(d3.range(data.dimensions.length)).rangeRound([
    margin.top,
    height - margin.bottom,
  ]);

  // setup the bars
  chart
    .selectAll("rect")
    .data(data.dimensions)
    .join("rect")
    .attr("fill", "rebeccapurple")
    .attr("x", x(0))
    .attr("y", (_, i) => y(i))
    .attr("height", y.bandwidth())
    .transition()
    .attr("width", (d) => x(d.weight) - x(0));

  const shortBar = (d) => x(d.weight) - x(0) < 100;

  // setup the labels
  chart
    .selectAll("text")
    .data(data.dimensions)
    .join("text")
    .attr("dy", ".35em")
    .attr("y", (_, i) => y(i) + (y.bandwidth() - 1) / 2)
    .transition()
    .attr("dx", (d) => (shortBar(d) ? ".6em" : 0))
    .attr("x", (d) => x(d.weight) - x(0))
    .attr("text-anchor", (d) => (shortBar(d) ? "start" : "end"))
    .attr("fill", (d) => (shortBar(d) ? "black" : "white"))
    .text((d) =>
      // other aspects are summarized in the last element but not always present
      d.aspects.length > 1 ? `${d.aspects.length} other` : d.aspects[0]
    );
}

function updateTable(data) {
  const columns = ["summary", "stance", "source", "aspects"];
  const table = d3.select("table#arguments");
  table
    .select("thead")
    .select("tr")
    .selectAll("th")
    .data(columns)
    .join("th")
    .text((d) => d);

  const row = table
    .select("tbody")
    .selectAll("tr")
    .data(data.arguments, (d) => d.id)
    .join("tr");
  row.append("td").text((d) => d.summary);
  row.append("td").text((d) => d.stance);
  row
    .append("td")
    .append("a")
    .attr("href", (d) => d.context.sourceUrl)
    .text((d) => d.context.sourceTitle);
  row
    .append("td")
    .text((d) =>
      "aspects" in d.context
        ? d.context.aspects.map((aspect) => aspect.name).join(", ")
        : ""
    );
}
