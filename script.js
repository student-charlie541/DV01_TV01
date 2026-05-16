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
      // Read the Excel file as binary string
      const workbook = XLSX.read(e.target.result, { type: "binary" });

      // Use the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      console.log("Raw Data:", rawData);
      console.log("Column Names:", Object.keys(rawData[0]));

      // Clean data for Age Group and Count of cases
      const cleanedData = rawData
        .map(function(row) {
          return {
            ageGroup: String(row["Age group"]).trim(),
            cases: Number(row["Count of cases"])
          };
        })
        .filter(function(row) {
          return row.ageGroup !== "" && !isNaN(row.cases);
        });

      console.log("Cleaned Data:", cleanedData);

      // Group by Age group and sum Count of cases
      const groupedData = d3.rollups(
        cleanedData,
        function(values) {
          return d3.sum(values, function(d) {
            return d.cases;
          });
        },
        function(d) {
          return d.ageGroup;
        }
      );

      // Convert grouped data into array
      const ageGroupData = groupedData.map(function(d) {
        return {
          ageGroup: d[0],
          hospitalisations: d[1]
        };
      });

      // Sort highest to lowest
      ageGroupData.sort(function(a, b) {
        return b.hospitalisations - a.hospitalisations;
      });

      console.log("Final Age Group Data:", ageGroupData);

      // Clear chart area
      d3.select("#chart").html("");

      // Draw pie chart
      drawPieChart(ageGroupData);

    } catch (error) {
      console.error("Error reading Excel:", error);
      document.getElementById("chart").innerHTML =
        "<p style='color:red; text-align:center;'>Error reading Excel file. Try downloading the file again.</p>";
    }
  };

  reader.readAsBinaryString(file);
});


// Draw D3 pie chart
function drawPieChart(data) {

  const width = 900;
  const height = 600;
  const radius = 220;

  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Main pie group
  const chartGroup = svg.append("g")
    .attr("transform", "translate(320,320)");

  // Colour scale
  const color = d3.scaleOrdinal()
    .domain(data.map(function(d) {
      return d.ageGroup;
    }))
    .range(d3.schemeTableau10);

  // Pie layout
  const pie = d3.pie()
    .value(function(d) {
      return d.hospitalisations;
    });

  // Pie slice shape
  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  // Larger arc for hover effect
  const hoverArc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius + 10);

  // Total for percentage calculation
  const total = d3.sum(data, function(d) {
    return d.hospitalisations;
  });

  // Tooltip
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

  // Draw pie slices
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

  // Add percentage labels inside pie
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