document.addEventListener("DOMContentLoaded", function () {

  // ─── COLUMN NAME CONSTANTS ───────────────────────────────────────────────
  const COL_YEAR     = "Calendar year";
  const COL_AGE      = "Age group";
  const COL_CASES    = "Count of cases";

  // ─── FILE UPLOAD ─────────────────────────────────────────────────────────
  document.getElementById("excelFile").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById("fileName").textContent = file.name;
    document.getElementById("barChart").innerHTML  = "<p class='empty-state'>Reading file…</p>";
    document.getElementById("pieChart").innerHTML  = "<p class='empty-state'>Reading file…</p>";

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const workbook  = XLSX.read(e.target.result, { type: "binary" });
        const sheet     = workbook.Sheets[workbook.SheetNames[0]];
        const rawData   = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rawData.length) {
          showError("The Excel file appears to be empty.");
          return;
        }

        // ── Clean & type rows ──────────────────────────────────────────────
        const cleaned = rawData
          .map(function (row) {
            return {
              year:     Number(row[COL_YEAR]),
              ageGroup: String(row[COL_AGE] || "").trim(),
              cases:    Number(row[COL_CASES]) || 0
            };
          })
          .filter(function (d) {
            return !isNaN(d.year) && d.ageGroup !== "" && d.cases > 0;
          });

        if (!cleaned.length) {
          showError("No valid rows found. Check that the column names match.");
          return;
        }

        // ── Yearly aggregation ─────────────────────────────────────────────
        const yearMap = d3.rollups(
          cleaned,
          function (v) { return d3.sum(v, function (d) { return d.cases; }); },
          function (d) { return d.year; }
        ).map(function (d) {
          return { year: d[0], hospitalisations: d[1] };
        }).sort(function (a, b) { return a.year - b.year; });

        // ── Age group aggregation ──────────────────────────────────────────
        const ageMap = d3.rollups(
          cleaned,
          function (v) { return d3.sum(v, function (d) { return d.cases; }); },
          function (d) { return d.ageGroup; }
        ).map(function (d) {
          return { ageGroup: d[0], hospitalisations: d[1] };
        }).sort(function (a, b) { return b.hospitalisations - a.hospitalisations; });

        // ── Stats ──────────────────────────────────────────────────────────
        const fmt   = d3.format(",");
        const total = d3.sum(cleaned, function (d) { return d.cases; });
        document.getElementById("totalCases").textContent   = fmt(total);
        document.getElementById("yearsCovered").textContent = yearMap.length;
        document.getElementById("topAgeGroup").textContent  = ageMap.length ? ageMap[0].ageGroup : "—";

        // ── Draw ───────────────────────────────────────────────────────────
        drawBarChart(yearMap);
        drawPieChart(ageMap);

      } catch (err) {
        console.error(err);
        showError("Could not read the Excel file. Please check the file and try again.");
      }
    };

    reader.readAsBinaryString(file);
  });

  // ─── ERROR HELPER ────────────────────────────────────────────────────────
  function showError(msg) {
    const html = "<p class='empty-state'>⚠️ " + msg + "</p>";
    document.getElementById("barChart").innerHTML = html;
    document.getElementById("pieChart").innerHTML = html;
  }

  // ─── BAR CHART ───────────────────────────────────────────────────────────
  function drawBarChart(data) {
    const container = document.getElementById("barChart");
    d3.select(container).html("");

    if (!data.length) {
      container.innerHTML = "<p class='empty-state'>No data to display.</p>";
      return;
    }

    const containerWidth = container.clientWidth || 880;
    const width  = Math.max(containerWidth, 500);
    const height = 420;
    const margin = { top: 20, right: 20, bottom: 60, left: 80 };

    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const x = d3.scaleBand()
      .domain(data.map(function (d) { return d.year; }))
      .range([margin.left, width - margin.right])
      .padding(0.25);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, function (d) { return d.hospitalisations; })])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Gridlines
    svg.append("g")
      .attr("transform", "translate(" + margin.left + ",0)")
      .call(
        d3.axisLeft(y)
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat("")
          .ticks(6)
      )
      .call(function (g) {
        g.select(".domain").remove();
        g.selectAll("line").attr("stroke", "#2a3349").attr("stroke-dasharray", "3,3");
      });

    const tooltip = d3.select("#tooltip");

    // Bars
    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x",      function (d) { return x(d.year); })
      .attr("y",      function (d) { return y(d.hospitalisations); })
      .attr("width",  x.bandwidth())
      .attr("height", function (d) { return y(0) - y(d.hospitalisations); })
      .attr("rx", 4)
      .on("mouseover", function (event, d) {
        tooltip.style("display", "block")
          .html("<strong>" + d.year + "</strong><br>Hospitalisations: " + d3.format(",")(d.hospitalisations));
      })
      .on("mousemove", function (event) {
        tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY + 14) + "px");
      })
      .on("mouseout", function () { tooltip.style("display", "none"); });

    // Value labels
    if (x.bandwidth() > 28) {
      svg.selectAll(".val-label")
        .data(data)
        .enter()
        .append("text")
        .attr("x", function (d) { return x(d.year) + x.bandwidth() / 2; })
        .attr("y", function (d) { return y(d.hospitalisations) - 5; })
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#8892a4")
        .text(function (d) {
          return data.length <= 15 ? d3.format(",")(d.hospitalisations) : "";
        });
    }

    // X axis
    svg.append("g")
      .attr("transform", "translate(0," + (height - margin.bottom) + ")")
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", data.length > 12 ? "rotate(-40)" : "rotate(0)")
      .style("text-anchor", data.length > 12 ? "end" : "middle");

    // Y axis
    svg.append("g")
      .attr("transform", "translate(" + margin.left + ",0)")
      .call(d3.axisLeft(y).tickFormat(d3.format(",")).ticks(6));

    // Axis labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#8892a4")
      .text("Calendar Year");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#8892a4")
      .text("Count of Cases");
  }

  // ─── PIE / DONUT CHART ───────────────────────────────────────────────────
  function drawPieChart(data) {
    const container = document.getElementById("pieChart");
    d3.select(container).html("");

    if (!data.length) {
      container.innerHTML = "<p class='empty-state'>No data to display.</p>";
      return;
    }

    const containerWidth = container.clientWidth || 880;
    const width  = Math.max(containerWidth, 500);
    const height = 480;
    const radius = Math.min(200, height / 2 - 40);
    const cx     = Math.min(320, width * 0.38);
    const cy     = height / 2;

    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const chartGroup = svg.append("g")
      .attr("transform", "translate(" + cx + "," + cy + ")");

    const palette = [
      "#4f8ef7","#f76f4f","#3ecf8e","#f7c94f","#b57bf7",
      "#f74f9e","#4fd3f7","#f7924f","#7bf77b","#f74f4f"
    ];
    const color = d3.scaleOrdinal()
      .domain(data.map(function (d) { return d.ageGroup; }))
      .range(palette);

    const pie     = d3.pie().value(function (d) { return d.hospitalisations; }).sort(null);
    const arc     = d3.arc().innerRadius(radius * 0.4).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.4).outerRadius(radius + 10);

    const total   = d3.sum(data, function (d) { return d.hospitalisations; });
    const tooltip = d3.select("#tooltip");

    // Slices
    chartGroup.selectAll("path")
      .data(pie(data))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", function (d) { return color(d.data.ageGroup); })
      .attr("stroke", "#1c2333")
      .attr("stroke-width", 2)
      .on("mouseover", function (event, d) {
        d3.select(this).transition().duration(150).attr("d", arcHover);
        tooltip.style("display", "block")
          .html(
            "<strong>" + d.data.ageGroup + "</strong><br>" +
            "Hospitalisations: " + d3.format(",")(d.data.hospitalisations) + "<br>" +
            "Share: " + ((d.data.hospitalisations / total) * 100).toFixed(1) + "%"
          );
      })
      .on("mousemove", function (event) {
        tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY + 14) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).transition().duration(150).attr("d", arc);
        tooltip.style("display", "none");
      });

    // Percentage labels
    chartGroup.selectAll(".slice-label")
      .data(pie(data))
      .enter()
      .append("text")
      .attr("class", "slice-label")
      .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#fff")
      .style("font-weight", "700")
      .text(function (d) {
        const pct = (d.data.hospitalisations / total) * 100;
        return pct >= 5 ? pct.toFixed(1) + "%" : "";
      });

    // Centre label
    chartGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.3em")
      .style("font-size", "13px")
      .style("fill", "#8892a4")
      .text("Total");

    chartGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .style("font-size", "20px")
      .style("font-weight", "800")
      .style("fill", "#e6eaf4")
      .text(d3.format(",")(total));

    // Legend
    const legendX       = cx + radius + 40;
    const legendSpacing = 28;
    const maxItems      = Math.floor((height - 40) / legendSpacing);

    const legend = svg.selectAll(".legend-item")
      .data(data.slice(0, maxItems))
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", function (d, i) {
        return "translate(" + legendX + "," + (40 + i * legendSpacing) + ")";
      });

    legend.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("rx", 3)
      .attr("fill", function (d) { return color(d.ageGroup); });

    legend.append("text")
      .attr("x", 22)
      .attr("y", 11)
      .style("font-size", "12px")
      .style("fill", "#c4cce0")
      .text(function (d) {
        return d.ageGroup + " – " + d3.format(",")(d.hospitalisations);
      });
  }

});
