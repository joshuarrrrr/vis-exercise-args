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

async function update() {
  // get the query terms from the text input
  const query = textInput.property("value").toLowerCase().replace(" ", "+");

  // send a request for the aspect space to the API
  const url = `https://www.args.me/api/v2/aspectSpace?query=${query}&format=json`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(data);

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

  // send request to the api for the actual arguments
  // step 1: get the number of arguments for the query
  const requestForNumOfArguments = `https://www.args.me//api/v2/arguments?query=${query}&fields=totalSize&format=json`;
  const NOAresponse = await fetch(requestForNumOfArguments);
  const numberOfArguments = (await NOAresponse.json()).totalSize;

  // step 2: request the arguments themselves (we need several requests, since the pageSize is limited to 1000 arguments)
  const pageSize = (numberOfArguments > 1000)?1000:numberOfArguments;
  let pageCounter = 0;
  const argumentList = [];
  while(pageCounter*pageSize < numberOfArguments) {
    const requestForPageOfArguments = `https://www.args.me//api/v2/arguments?query=${query}&fields=arguments.conclusion,arguments.premises,arguments.stance,arguments.context.aspects,arguments.explanation.score&pageSize=${pageSize}&page=${pageCounter+1}&format=json`;
    const NOPresponse = await fetch(requestForPageOfArguments);
    const pageOfArguments = (await NOPresponse.json()).arguments;
    
    for(let argument of pageOfArguments) {
      const newForm = {conclusion: argument.conclusion,
                       premises: argument.premises.map(text => text.text),
                       stance: argument.stance,
                       relevance: argument.explanation.score,
                       aspects: (argument.context.aspects)?argument.context.aspects.map(aspect => ({name: aspect.name, weight: aspect.normalizedWeight})):[]}
      argumentList.push(newForm);
    }
    pageCounter += 1;
  }
  console.log(argumentList);
}
