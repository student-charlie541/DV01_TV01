document.getElementById("excelFile").addEventListener("change", function(event) {

  const file = event.target.files[0];

  if (!file) {
    alert("Please choose an Excel file.");
    return;
  }

  document.getElementById("fileName").textContent = file.name;

  document.getElementById("chart").innerHTML =
    "<p class='loading-message'>Reading Excel file...</p>";

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const workbook = XLSX.read(e.target.result, { type: "binary" });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (rawData.length === 0) {
        document.getElementById("chart").innerHTML =
          "<p class='error-message'>The Excel file is empty or could not be read.</p>";
        return;
      }

      const yearCleanedData = rawData
        .map(function(row) {
          return {
            year: Number(row["Calendar year"]),
            cases: Number(row["Count of cases"])
          };
        })
        .filter(function(row) {
          return !isNaN(row.year) && !isNaN(row.cases);
        });

      const yearlyGroupedData = d3.rollups(
        yearCleanedData,
        function(values) {
          return d3.sum(values, function(d) {
            return d.cases;
          });
        },
        function(d) {
          return d.year;
        }
      );

      const yearlyData = yearlyGroupedData.map(function(d) {
        return {
          year: d[0],
          hospitalisations: d[1]
        };
      });

      yearlyData.sort(function(a, b) {
        return a.year - b.year;
      });

      const ageCleanedData = rawData
        .map(function(row) {
          return {
            ageGroup: String(row["Age group"]).trim(),
            cases: Number(row["Count of cases"])
          };
        })
        .filter(function(row) {
          return row.ageGroup !== "" && !isNaN(row.cases);
        });

      const ageGroupedData = d3.rollups(
        ageCleanedData,
        function(values) {
          return d3.sum(values, function(d) {
            return d.cases;
          });
        },
        function(d) {
          return d.ageGroup;
        }
      );

      const ageGroupData = ageGroupedData.map(function(d) {
        return {
          ageGroup: d[0],
          hospitalisations: d[1]
        };
      });

      ageGroupData.sort(function(a, b) {
        return b.hospitalisations - a.hospitalisations;
      });

      updateSummaryCards(rawData, yearlyData, yearCleanedData);

      d3.select("#chart").html("");

      drawBarChart(yearlyData);
      drawPieChart(ageGroupData);

    } catch (error) {
      console.error(error);
      document.getElementById("chart").innerHTML =
        "<p class='error-message'>Error reading Excel file. Please check the file and try again.</p>";
    }
  };

  reader.readAsBinaryString(file);
});


function updateSummaryCards(rawData, yearlyData, yearCleanedData) {
  const totalCases = d3.sum(yearCleanedData, function(d) {
    return d.cases;
  });

  document.getElementById("totalRecords").textContent = d3.format(",")(rawData.length);
  document.getElementById("totalCases").textContent = d3.format(",")(totalCases);
  document.getElementById("yearsCovered").textContent = yearlyData.length;
}


function drawBarChart(data) {

  const width = 900;
  const height = 500;

  const margin = {
    top: 50,
    right: 30,
    bottom: 70,
    left: 110
  };

  const barContainer = d3.select("#chart")
    .append("div")
    .attr("class", "chart-section");

  barContainer.append("h2")
    .text("Hospitalisations by Calendar Year");

  barContainer.append("p")
    .attr("class", "chart-note")
    .text("This bar chart shows the total number of hospitalisations grouped by calendar year.");

  const svg = barContainer
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleBand()
    .domain(data.map(function(d) {
      return d.year;
    }))
    .range([margin.left, width - margin.right])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, function(d) {
      return d.hospitalisations;
    })])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(
      d3.axisLeft(y)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat("")
    )
    .selectAll("line")
    .attr("stroke", "#dbe4f3");

  svg.selectAll(".domain").remove();

  svg.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", function(d) {
      return x(d.year);
    })
    .attr("y", function(d) {
      return y(d.hospitalisations);
    })
    .attr("width", x.bandwidth())
    .attr("height", function(d) {
      return y(0) - y(d.hospitalisations);
    })
    .attr("rx", 8);

  svg.selectAll(".value-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value-label")
    .attr("x", function(d) {
      return x(d.year) + x.bandwidth() / 2;
    })
    .attr("y", function(d) {
      return y(d.hospitalisations) - 8;
    })
    .attr("text-anchor", "middle")
    .text(function(d) {
      return d3.format(",")(d.hospitalisations);
    });

  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#334155");

  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).tickFormat(d3.format(",")))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#334155");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 20)
    .attr("text-anchor", "middle")
    .text("Calendar Year");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .text("Sum of Count of Cases");
}


function drawPieChart(data) {

  const width = 900;
  const height = 600;
  const radius = 210;

  const pieContainer = d3.select("#chart")
    .append("div")
    .attr("class", "chart-section");

  pieContainer.append("h2")
    .text("Hospitalisations by Age Group");

  pieContainer.append("p")
    .attr("class", "chart-note")
    .text("This donut chart shows the distribution of hospitalisations across different age groups.");

  const svg = pieContainer
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const chartGroup = svg.append("g")
    .attr("transform", "translate(320,320)");

  const color = d3.scaleOrdinal()
    .domain(data.map(function(d) {
      return d.ageGroup;
    }))
    .range(d3.schemeTableau10);

  const pie = d3.pie()
    .value(function(d) {
      return d.hospitalisations;
    });

  const arc = d3.arc()
    .innerRadius(85)
    .outerRadius(radius);

  const hoverArc = d3.arc()
    .innerRadius(85)
    .outerRadius(radius + 10);

  const total = d3.sum(data, function(d) {
    return d.hospitalisations;
  });

  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

  chartGroup.selectAll("path")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", function(d) {
      return color(d.data.ageGroup);
    })
    .attr("stroke", "white")
    .attr("stroke-width", 4)
    .on("mouseover", function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("d", hoverArc);

      tooltip
        .style("display", "block")
        .html(
          "<strong>" + d.data.ageGroup + "</strong><br>" +
          "Hospitalisations: " + d3.format(",")(d.data.hospitalisations) + "<br>" +
          "Percentage: " + ((d.data.hospitalisations / total) * 100).toFixed(1) + "%"
        );
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mouseout", function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("d", arc);

      tooltip.style("display", "none");
    });

  chartGroup.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -5)
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .style("fill", "#123c69")
    .text("Total");

  chartGroup.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 24)
    .style("font-size", "16px")
    .style("fill", "#334155")
    .text(d3.format(",")(total));

  chartGroup.selectAll(".pie-label")
    .data(pie(data))
    .enter()
    .append("text")
    .attr("transform", function(d) {
      return "translate(" + arc.centroid(d) + ")";
    })
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "white")
    .style("font-weight", "bold")
    .text(function(d) {
      const percent = (d.data.hospitalisations / total) * 100;

      if (percent < 5) {
        return "";
      }

      return percent.toFixed(1) + "%";
    });

  const legend = svg.selectAll(".legend")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", function(d, i) {
      return "translate(610," + (110 + i * 32) + ")";
    });

  legend.append("rect")
    .attr("width", 18)
    .attr("height", 18)
    .attr("rx", 5)
    .attr("fill", function(d) {
      return color(d.ageGroup);
    });

  legend.append("text")
    .attr("x", 28)
    .attr("y", 14)
    .style("font-size", "13px")
    .style("fill", "#334155")
    .text(function(d) {
      return d.ageGroup + " - " + d3.format(",")(d.hospitalisations);
    });
}
