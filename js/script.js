// Wait until user chooses the Excel file
document.getElementById("excelFile").addEventListener("change", function(event) {

  const file = event.target.files[0];

  if (!file) {
    alert("Please choose an Excel file.");
    return;
  }

  document.getElementById("chart").innerHTML =
    "<p style='text-align:center; color:blue;'>Reading Excel file...</p>";

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      // Read the Excel file
      const workbook = XLSX.read(e.target.result, { type: "binary" });

      // Use the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert Excel sheet to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      console.log("Raw Data:", rawData);
      console.log("Column Names:", Object.keys(rawData[0]));

      // -------------------------------
      // DATA FOR BAR CHART: YEARLY TOTAL
      // -------------------------------
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

      console.log("Final Yearly Data:", yearlyData);

      // -------------------------------
      // DATA FOR PIE CHART: AGE GROUP
      // -------------------------------
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

      console.log("Final Age Group Data:", ageGroupData);

      // Clear chart area
      d3.select("#chart").html("");

      // Draw both charts
      drawBarChart(yearlyData);
      drawPieChart(ageGroupData);

    } catch (error) {
      console.error("Error reading Excel:", error);
      document.getElementById("chart").innerHTML =
        "<p style='color:red; text-align:center;'>Error reading Excel file. Try downloading the Excel file again.</p>";
    }
  };

  reader.readAsBinaryString(file);
});


// -------------------------------------
// BAR CHART: Hospitalisations by Year
// -------------------------------------
function drawBarChart(data) {

  const width = 900;
  const height = 500;

  const margin = {
    top: 60,
    right: 30,
    bottom: 70,
    left: 110
  };

  const barContainer = d3.select("#chart")
    .append("div")
    .attr("class", "chart-section");

  barContainer.append("h2")
    .text("Hospitalisations by Calendar Year");

  const svg = barContainer
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleBand()
    .domain(data.map(function(d) {
      return d.year;
    }))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, function(d) {
      return d.hospitalisations;
    })])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // Bars
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
    .attr("fill", "steelblue");

  // Value labels
  svg.selectAll(".value-label")
    .data(data)
    .enter()
    .append("text")
    .attr("x", function(d) {
      return x(d.year) + x.bandwidth() / 2;
    })
    .attr("y", function(d) {
      return y(d.hospitalisations) - 5;
    })
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(function(d) {
      return d3.format(",")(d.hospitalisations);
    });

  // X axis
  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x));

  // Y axis
  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).tickFormat(d3.format(",")));

  // Chart title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "bold")
    .style("fill", "#1f3c88")
    .text("Sum of Hospitalisations by Calendar Year");

  // X label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 20)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Calendar Year");

  // Y label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Sum of Count of Cases");
}


// -------------------------------------
// PIE CHART: Hospitalisations by Age Group
// -------------------------------------
function drawPieChart(data) {

  const width = 900;
  const height = 600;
  const radius = 220;

  const pieContainer = d3.select("#chart")
    .append("div")
    .attr("class", "chart-section");

  pieContainer.append("h2")
    .text("Hospitalisations by Age Group");

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
    .innerRadius(0)
    .outerRadius(radius);

  const hoverArc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius + 10);

  const total = d3.sum(data, function(d) {
    return d.hospitalisations;
  });

  const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #999")
    .style("padding", "10px")
    .style("border-radius", "8px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.2)")
    .style("font-size", "13px")
    .style("display", "none")
    .style("pointer-events", "none");

  // Pie slices
  chartGroup.selectAll("path")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", function(d) {
      return color(d.data.ageGroup);
    })
    .attr("stroke", "white")
    .attr("stroke-width", 3)
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

  // Percentage labels
  chartGroup.selectAll("text")
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

  // Chart title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 35)
    .attr("text-anchor", "middle")
    .style("font-size", "22px")
    .style("font-weight", "bold")
    .style("fill", "#1f3c88")
    .text("Hospitalisations by Age Group");

  // Subtitle
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 60)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("fill", "#555")
    .text("Sum of Count of Cases grouped by Age Group");

  // Legend
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
    .attr("rx", 4)
    .attr("fill", function(d) {
      return color(d.ageGroup);
    });

  legend.append("text")
    .attr("x", 26)
    .attr("y", 14)
    .style("font-size", "13px")
    .style("fill", "#333")
    .text(function(d) {
      return d.ageGroup + " - " + d3.format(",")(d.hospitalisations);
    });
}
