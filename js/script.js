// ─── COLUMN NAME CONSTANTS ───────────────────────────────────────────────────
const COL_YEAR         = "Calendar year";
const COL_AGE          = "Age group";
const COL_CASES        = "Count of cases";
const COL_SEX          = "Sex";
const COL_ROADUSER     = "Road user";
const COL_REMOTE       = "ABS remoteness area";
const COL_CAUSE        = "Cause of injury";
const COL_COUNTERPARTY = "Counterparty";

let allData = [];

// ─── AUTO-LOAD ON PAGE READY ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  loadCSVFile("data/hospitalization.csv");

  // Filter change listeners
  [
    "yearFilter", "ageFilter", "sexFilter",
    "roadUserFilter", "remotenessFilter", "causeFilter", "counterpartyFilter"
  ].forEach(function (id) {
    document.getElementById(id).addEventListener("change", applyFilters);
  });

  // Reset button
  document.getElementById("resetFilters").addEventListener("click", function () {
    [
      "yearFilter", "ageFilter", "sexFilter",
      "roadUserFilter", "remotenessFilter", "causeFilter", "counterpartyFilter"
    ].forEach(function (id) {
      document.getElementById(id).value = "all";
    });
    applyFilters();
  });
});

// ─── FETCH & PARSE CSV ───────────────────────────────────────────────────────
function loadCSVFile(path) {
  d3.csv(path)
    .then(function (rawData) {
      if (!rawData.length) {
        showError("The CSV file appears to be empty.");
        return;
      }

      // Log actual column names from CSV so mismatches are visible in console
      console.log("CSV loaded. Row count:", rawData.length);
      console.log("Columns found:", Object.keys(rawData[0]));
      console.log("First row sample:", rawData[0]);

      allData = rawData
        .map(function (row) {
          return {
            year:         Number(row[COL_YEAR]),
            ageGroup:     String(row[COL_AGE]          || "").trim(),
            sex:          String(row[COL_SEX]           || "").trim(),
            roadUser:     String(row[COL_ROADUSER]      || "").trim(),
            remoteness:   String(row[COL_REMOTE]        || "").trim(),
            cause:        String(row[COL_CAUSE]         || "").trim(),
            counterparty: String(row[COL_COUNTERPARTY]  || "").trim(),
            cases:        Number(row[COL_CASES])        || 0
          };
        })
        .filter(function (d) {
          return !isNaN(d.year) && d.year > 0 && d.ageGroup !== "" && d.cases > 0;
        });

      console.log("Rows after filtering:", allData.length);
      if (allData.length > 0) console.log("Sample parsed row:", allData[0]);

      if (!allData.length) {
        showError("No valid rows found — open browser console (F12) and check 'Columns found' to verify CSV headers match exactly.");
        return;
      }

      document.getElementById("loadStatus").textContent = "Data loaded successfully.";
      document.getElementById("loadStatus").classList.add("load-status--ok");

      populateFilters();
      applyFilters();
    })
    .catch(function (err) {
      console.error("CSV fetch error:", err);
      showError("Could not load the CSV — make sure 'data/hospitalization.csv' exists and you are using Live Server, not opening the file directly.");
    });
}

// ─── POPULATE FILTER DROPDOWNS ───────────────────────────────────────────────
function populateSelect(id, values) {
  var select = document.getElementById(id);
  while (select.options.length > 1) { select.remove(1); }
  values.forEach(function (val) {
    if (!val && val !== 0) return;
    var opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  });
}

function populateFilters() {
  populateSelect(
    "yearFilter",
    [...new Set(allData.map(function (d) { return d.year; }))].sort(function (a, b) { return a - b; })
  );
  populateSelect("ageFilter",         [...new Set(allData.map(function (d) { return d.ageGroup; }))]);
  populateSelect("sexFilter",         [...new Set(allData.map(function (d) { return d.sex; }))]);
  populateSelect("roadUserFilter",    [...new Set(allData.map(function (d) { return d.roadUser; }))]);
  populateSelect("remotenessFilter",  [...new Set(allData.map(function (d) { return d.remoteness; }))]);
  populateSelect("causeFilter",       [...new Set(allData.map(function (d) { return d.cause; }))]);
  populateSelect("counterpartyFilter",[...new Set(allData.map(function (d) { return d.counterparty; }))]);
}

// ─── APPLY FILTERS & UPDATE DASHBOARD ────────────────────────────────────────
function applyFilters() {
  var year         = document.getElementById("yearFilter").value;
  var age          = document.getElementById("ageFilter").value;
  var sex          = document.getElementById("sexFilter").value;
  var roadUser     = document.getElementById("roadUserFilter").value;
  var remoteness   = document.getElementById("remotenessFilter").value;
  var cause        = document.getElementById("causeFilter").value;
  var counterparty = document.getElementById("counterpartyFilter").value;

  var filtered = allData.filter(function (d) {
    return (year         === "all" || d.year         == year)        &&
           (age          === "all" || d.ageGroup     === age)        &&
           (sex          === "all" || d.sex          === sex)        &&
           (roadUser     === "all" || d.roadUser     === roadUser)   &&
           (remoteness   === "all" || d.remoteness   === remoteness) &&
           (cause        === "all" || d.cause        === cause)      &&
           (counterparty === "all" || d.counterparty === counterparty);
  });

  updateDashboard(filtered);
}

function updateDashboard(filtered) {
  var yearlyData = d3.rollups(
    filtered,
    function (v) { return d3.sum(v, function (d) { return d.cases; }); },
    function (d) { return d.year; }
  )
  .map(function (d) { return { year: d[0], hospitalisations: d[1] }; })
  .sort(function (a, b) { return a.year - b.year; });

  var ageData = d3.rollups(
    filtered,
    function (v) { return d3.sum(v, function (d) { return d.cases; }); },
    function (d) { return d.ageGroup; }
  )
  .map(function (d) { return { ageGroup: d[0], hospitalisations: d[1] }; })
  .sort(function (a, b) { return b.hospitalisations - a.hospitalisations; });

  var total = d3.sum(filtered, function (d) { return d.cases; });
  document.getElementById("totalCases").textContent   = d3.format(",")(total);
  document.getElementById("yearsCovered").textContent = [...new Set(filtered.map(function (d) { return d.year; }))].length;
  document.getElementById("topAgeGroup").textContent  = ageData.length ? ageData[0].ageGroup : "—";

  drawBarChart(yearlyData);
  drawPieChart(ageData);
}

// ─── ERROR HELPER ─────────────────────────────────────────────────────────────
function showError(msg) {
  var html = "<p class='empty-state'>⚠️ " + msg + "</p>";
  document.getElementById("barChart").innerHTML  = html;
  document.getElementById("pieChart").innerHTML  = html;
  document.getElementById("loadStatus").textContent = "Error loading data.";
  document.getElementById("loadStatus").classList.add("load-status--error");
}

// ─── BAR CHART ────────────────────────────────────────────────────────────────
function drawBarChart(data) {
  var container = document.getElementById("barChart");
  d3.select(container).html("");

  if (!data.length) {
    container.innerHTML = "<p class='empty-state'>No data for current filter selection.</p>";
    return;
  }

  var containerWidth = container.clientWidth || 880;
  var width  = Math.max(containerWidth, 500);
  var height = 420;
  var margin = { top: 20, right: 20, bottom: 60, left: 80 };

  var svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  var x = d3.scaleBand()
    .domain(data.map(function (d) { return d.year; }))
    .range([margin.left, width - margin.right])
    .padding(0.25);

  var y = d3.scaleLinear()
    .domain([0, d3.max(data, function (d) { return d.hospitalisations; })])
    .nice()
    .range([height - margin.bottom, margin.top]);

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

  var tooltip = d3.select("#tooltip");

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

  if (x.bandwidth() > 28 && data.length <= 15) {
    svg.selectAll(".val-label")
      .data(data)
      .enter()
      .append("text")
      .attr("x", function (d) { return x(d.year) + x.bandwidth() / 2; })
      .attr("y", function (d) { return y(d.hospitalisations) - 5; })
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#8892a4")
      .text(function (d) { return d3.format(",")(d.hospitalisations); });
  }

  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", data.length > 12 ? "rotate(-40)" : "rotate(0)")
    .style("text-anchor", data.length > 12 ? "end" : "middle");

  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).tickFormat(d3.format(",")).ticks(6));

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

// ─── PIE / DONUT CHART ────────────────────────────────────────────────────────
function drawPieChart(data) {
  var container = document.getElementById("pieChart");
  d3.select(container).html("");

  if (!data.length) {
    container.innerHTML = "<p class='empty-state'>No data for current filter selection.</p>";
    return;
  }

  var containerWidth = container.clientWidth || 880;
  var width  = Math.max(containerWidth, 500);
  var height = 480;
  var radius = Math.min(200, height / 2 - 40);
  var cx     = Math.min(320, width * 0.38);
  var cy     = height / 2;

  var svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  var chartGroup = svg.append("g")
    .attr("transform", "translate(" + cx + "," + cy + ")");

  var palette = [
    "#4f8ef7","#f76f4f","#3ecf8e","#f7c94f","#b57bf7",
    "#f74f9e","#4fd3f7","#f7924f","#7bf77b","#f74f4f"
  ];
  var color = d3.scaleOrdinal()
    .domain(data.map(function (d) { return d.ageGroup; }))
    .range(palette);

  var pie      = d3.pie().value(function (d) { return d.hospitalisations; }).sort(null);
  var arc      = d3.arc().innerRadius(radius * 0.4).outerRadius(radius);
  var arcHover = d3.arc().innerRadius(radius * 0.4).outerRadius(radius + 10);
  var total    = d3.sum(data, function (d) { return d.hospitalisations; });
  var tooltip  = d3.select("#tooltip");

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
      var pct = (d.data.hospitalisations / total) * 100;
      return pct >= 5 ? pct.toFixed(1) + "%" : "";
    });

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

  var legendX       = cx + radius + 40;
  var legendSpacing = 28;
  var maxItems      = Math.floor((height - 40) / legendSpacing);

  var legend = svg.selectAll(".legend-item")
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
