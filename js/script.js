// COLUMN NAME CONSTANTS
const COL_YEAR         = "Calendar year";
const COL_AGE          = "Age group";
const COL_CASES        = "Count of cases";
const COL_SEX          = "Sex";
const COL_ROADUSER     = "Road user";
const COL_REMOTE       = "ABS remoteness area";
const COL_CAUSE        = "Cause of injury";
const COL_COUNTERPARTY = "Counterparty";

let allData = [];

// Filter state: map of fieldKey -> Set of selected values (empty Set = all selected)
const filterState = {
  year:         new Set(),
  ageGroup:     new Set(),
  sex:          new Set(),
  roadUser:     new Set(),
  remoteness:   new Set(),
  cause:        new Set(),
  counterparty: new Set()
};

// AUTO-LOAD ON PAGE READY 
document.addEventListener("DOMContentLoaded", function () {
  loadCSVFile("data/hospitalization.csv");

  document.getElementById("resetFilters").addEventListener("click", function () {
    Object.keys(filterState).forEach(function (key) {
      filterState[key].clear();
    });
    // Uncheck all checkboxes
    document.querySelectorAll(".filter-checkbox").forEach(function (cb) {
      cb.checked = false;
    });
    applyFilters();
  });
});

// FETCH & PARSE CSV
function loadCSVFile(path) {
  d3.csv(path)
    .then(function (rawData) {
      if (!rawData.length) {
        showError("The CSV file appears to be empty.");
        return;
      }

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
          return !isNaN(d.year) && d.year > 0 && d.ageGroup !== "" && d.cases > 0 && d.roadUser !== "Not applicable";
        });

      if (!allData.length) {
        showError("No valid rows found — check that column names match the CSV headers.");
        return;
      }

      document.getElementById("loadStatus").textContent = "Data loaded successfully.";
      document.getElementById("loadStatus").classList.add("load-status--ok");

      buildCheckboxFilters();
      applyFilters();
    })
    .catch(function (err) {
      console.error("CSV fetch error:", err);
      showError("Could not load the CSV — make sure 'data/hospitalization.csv' exists and you are using Live Server.");
    });
}

// BUILD CHECKBOX FILTER GROUPS
var filterConfig = [
  { key: "year",         label: "Year",             values: function () {
      return [...new Set(allData.map(function (d) { return d.year; }))].sort(function (a, b) { return b - a; });
  }},
  { key: "sex",          label: "Sex",              values: function () {
      return [...new Set(allData.map(function (d) { return d.sex; }))].sort();
  }},
  { key: "roadUser",     label: "Road User",        values: function () {
      return [...new Set(allData.map(function (d) { return d.roadUser; }))].sort();
  }},
  { key: "ageGroup",     label: "Age Group",        values: function () {
      return [...new Set(allData.map(function (d) { return d.ageGroup; }))].sort();
  }},
  { key: "remoteness",   label: "Remoteness Area",  values: function () {
      return [...new Set(allData.map(function (d) { return d.remoteness; }))].sort();
  }},
  { key: "cause",        label: "Cause of Injury",  values: function () {
      return [...new Set(allData.map(function (d) { return d.cause; }))].sort();
  }},
  { key: "counterparty", label: "Counterparty",     values: function () {
      return [...new Set(allData.map(function (d) { return d.counterparty; }))].sort();
  }}
];

function buildCheckboxFilters() {
  var container = document.getElementById("filtersContainer");
  container.innerHTML = "";

  filterConfig.forEach(function (cfg) {
    var group = document.createElement("div");
    group.className = "filter-group";

    var title = document.createElement("div");
    title.className = "filter-group-title";
    title.textContent = cfg.label;
    group.appendChild(title);

    var list = document.createElement("div");
    list.className = "filter-group-list";

    cfg.values().forEach(function (val) {
      var label = document.createElement("label");
      label.className = "filter-option";

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "filter-checkbox";
      cb.dataset.key = cfg.key;
      cb.dataset.val = val;

      cb.addEventListener("change", function () {
        if (cb.checked) {
          filterState[cfg.key].add(String(val));
        } else {
          filterState[cfg.key].delete(String(val));
        }
        applyFilters();
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + val));
      list.appendChild(label);
    });

    group.appendChild(list);
    container.appendChild(group);
  });
}

// APPLY FILTERS & UPDATE DASHBOARD 
function applyFilters() {
  var filtered = allData.filter(function (d) {
    return (filterState.year.size         === 0 || filterState.year.has(String(d.year)))         &&
           (filterState.ageGroup.size     === 0 || filterState.ageGroup.has(d.ageGroup))         &&
           (filterState.sex.size          === 0 || filterState.sex.has(d.sex))                   &&
           (filterState.roadUser.size     === 0 || filterState.roadUser.has(d.roadUser))         &&
           (filterState.remoteness.size   === 0 || filterState.remoteness.has(d.remoteness))     &&
           (filterState.cause.size        === 0 || filterState.cause.has(d.cause))               &&
           (filterState.counterparty.size === 0 || filterState.counterparty.has(d.counterparty));
  });

  updateDashboard(filtered);
}

// UPDATE DASHBOARD
function updateDashboard(filtered) {
  // Yearly aggregation for trend line
  var yearlyData = d3.rollups(
    filtered,
    function (v) { return d3.sum(v, function (d) { return d.cases; }); },
    function (d) { return d.year; }
  )
  .map(function (d) { return { year: d[0], injuries: d[1] }; })
  .sort(function (a, b) { return a.year - b.year; });

  // Road user aggregation for pie chart
  var roadUserData = d3.rollups(
    filtered,
    function (v) { return d3.sum(v, function (d) { return d.cases; }); },
    function (d) { return d.roadUser; }
  )
  .map(function (d) { return { roadUser: d[0], injuries: d[1] }; })
  .sort(function (a, b) { return b.injuries - a.injuries; });

  // Age group aggregation for bar chart
  var ageData = d3.rollups(
    filtered,
    function (v) { return d3.sum(v, function (d) { return d.cases; }); },
    function (d) { return d.ageGroup; }
  )
  .map(function (d) { return { ageGroup: d[0], injuries: d[1] }; })
  .sort(function (a, b) { return b.injuries - a.injuries; });

  // Stat cards
  var total      = d3.sum(filtered, function (d) { return d.cases; });
  var yearCount  = yearlyData.length;
  var avgPerYear = yearCount > 0 ? Math.round(total / yearCount) : 0;
  var topRU      = roadUserData.length ? roadUserData[0].roadUser : "—";

  document.getElementById("totalCases").textContent = d3.format(",")(total);
  document.getElementById("avgPerYear").textContent  = d3.format(",")(avgPerYear);
  document.getElementById("topRoadUser").textContent = topRU;

  drawLineChart(yearlyData);
  drawRoadUserPie(roadUserData);
  drawAgeBarChart(ageData);
}

// ERROR HELPER
function showError(msg) {
  ["lineChart", "roadUserChart", "ageChart"].forEach(function (id) {
    document.getElementById(id).innerHTML = "<p class='empty-state'>⚠️ " + msg + "</p>";
  });
  document.getElementById("loadStatus").textContent = "Error loading data.";
  document.getElementById("loadStatus").classList.add("load-status--error");
}

// SHARED HELPERS
var palette = [
  "#4f8ef7","#f76f4f","#3ecf8e","#f7c94f","#b57bf7",
  "#f74f9e","#4fd3f7","#f7924f","#7bf77b","#f74f4f",
  "#a78bfa","#34d399","#fb923c","#e879f9","#22d3ee"
];

// 1. LINE CHART — INJURY TREND OVER TIME
function drawLineChart(data) {
  var container = document.getElementById("lineChart");
  d3.select(container).html("");

  if (!data.length) {
    container.innerHTML = "<p class='empty-state'>No data for current filter selection.</p>";
    return;
  }

  var width  = Math.max(container.clientWidth || 880, 500);
  var height = 420;
  var margin = { top: 20, right: 30, bottom: 60, left: 80 };

  var svg = d3.select(container).append("svg")
    .attr("width", width).attr("height", height);

  var x = d3.scaleLinear()
    .domain(d3.extent(data, function (d) { return d.year; }))
    .range([margin.left, width - margin.right]);

  var y = d3.scaleLinear()
    .domain([0, d3.max(data, function (d) { return d.injuries; })]).nice()
    .range([height - margin.bottom, margin.top]);

  // Gridlines
  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).tickSize(-(width - margin.left - margin.right)).tickFormat("").ticks(6))
    .call(function (g) {
      g.select(".domain").remove();
      g.selectAll("line").attr("stroke", "#2a3349").attr("stroke-dasharray", "3,3");
    });

  // Area fill under line
  var area = d3.area()
    .x(function (d) { return x(d.year); })
    .y0(height - margin.bottom)
    .y1(function (d) { return y(d.injuries); })
    .curve(d3.curveMonotoneX);

  svg.append("path")
    .datum(data)
    .attr("fill", "rgba(79,142,247,0.12)")
    .attr("d", area);

  // Line
  var line = d3.line()
    .x(function (d) { return x(d.year); })
    .y(function (d) { return y(d.injuries); })
    .curve(d3.curveMonotoneX);

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#4f8ef7")
    .attr("stroke-width", 3)
    .attr("d", line);

  // Dots
  var tooltip = d3.select("#tooltip");
  svg.selectAll(".dot")
    .data(data).enter().append("circle")
    .attr("class", "dot")
    .attr("cx", function (d) { return x(d.year); })
    .attr("cy", function (d) { return y(d.injuries); })
    .attr("r", 5)
    .attr("fill", "#4f8ef7")
    .attr("stroke", "#1c2333")
    .attr("stroke-width", 2)
    .on("mouseover", function (event, d) {
      tooltip.style("display", "block")
        .html("<strong>" + d.year + "</strong><br>Injuries: " + d3.format(",")(d.injuries));
    })
    .on("mousemove", function (event) {
      tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY + 14) + "px");
    })
    .on("mouseout", function () { tooltip.style("display", "none"); });

  // Axes
  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(data.length));

  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).tickFormat(d3.format(",")).ticks(6));

  // Axis labels
  svg.append("text").attr("x", width / 2).attr("y", height - 10)
    .attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#8892a4")
    .text("Calendar Year");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -(height / 2)).attr("y", 18)
    .attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#8892a4")
    .text("Count of Injuries");
}

// 2. PIE CHART — INJURIES BY ROAD USER TYPE
function drawRoadUserPie(data) {
  var container = document.getElementById("roadUserChart");
  d3.select(container).html("");

  if (!data.length) {
    container.innerHTML = "<p class='empty-state'>No data for current filter selection.</p>";
    return;
  }

  var width  = Math.max(container.clientWidth || 880, 500);
  var height = 480;
  var radius = Math.min(200, height / 2 - 40);
  var cx     = Math.min(280, width * 0.35);
  var cy     = height / 2;

  var svg = d3.select(container).append("svg")
    .attr("width", width).attr("height", height);

  var chartGroup = svg.append("g")
    .attr("transform", "translate(" + cx + "," + cy + ")");

  var color = d3.scaleOrdinal()
    .domain(data.map(function (d) { return d.roadUser; }))
    .range(palette);

  var pie      = d3.pie().value(function (d) { return d.injuries; }).sort(null);
  var arc      = d3.arc().innerRadius(radius * 0.4).outerRadius(radius);
  var arcHover = d3.arc().innerRadius(radius * 0.4).outerRadius(radius + 10);
  var total    = d3.sum(data, function (d) { return d.injuries; });
  var tooltip  = d3.select("#tooltip");

  chartGroup.selectAll("path")
    .data(pie(data)).enter().append("path")
    .attr("d", arc)
    .attr("fill", function (d) { return color(d.data.roadUser); })
    .attr("stroke", "#1c2333").attr("stroke-width", 2)
    .on("mouseover", function (event, d) {
      d3.select(this).transition().duration(150).attr("d", arcHover);
      tooltip.style("display", "block").html(
        "<strong>" + d.data.roadUser + "</strong><br>" +
        "Injuries: " + d3.format(",")(d.data.injuries) + "<br>" +
        "Share: " + ((d.data.injuries / total) * 100).toFixed(1) + "%"
      );
    })
    .on("mousemove", function (event) {
      tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY + 14) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).transition().duration(150).attr("d", arc);
      tooltip.style("display", "none");
    });

  // Slice % labels
  chartGroup.selectAll(".slice-label")
    .data(pie(data)).enter().append("text")
    .attr("class", "slice-label")
    .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
    .attr("text-anchor", "middle")
    .style("font-size", "11px").style("fill", "#fff").style("font-weight", "700")
    .text(function (d) {
      var pct = (d.data.injuries / total) * 100;
      return pct >= 5 ? pct.toFixed(1) + "%" : "";
    });

  // Centre label
  chartGroup.append("text").attr("text-anchor", "middle").attr("dy", "-0.3em")
    .style("font-size", "13px").style("fill", "#8892a4").text("Total");
  chartGroup.append("text").attr("text-anchor", "middle").attr("dy", "1.1em")
    .style("font-size", "20px").style("font-weight", "800").style("fill", "#e6eaf4")
    .text(d3.format(",")(total));

  // Legend
  var legendX       = cx + radius + 30;
  var legendSpacing = 26;
  var maxItems      = Math.floor((height - 40) / legendSpacing);

  var legend = svg.selectAll(".legend-item")
    .data(data.slice(0, maxItems)).enter()
    .append("g").attr("class", "legend-item")
    .attr("transform", function (d, i) {
      return "translate(" + legendX + "," + (40 + i * legendSpacing) + ")";
    });

  legend.append("rect").attr("width", 13).attr("height", 13).attr("rx", 3)
    .attr("fill", function (d) { return color(d.roadUser); });
  legend.append("text").attr("x", 20).attr("y", 11)
    .style("font-size", "12px").style("fill", "#c4cce0")
    .text(function (d) {
      return d.roadUser + " – " + d3.format(",")(d.injuries);
    });
}

// 3. BAR CHART INJURIES BY AGE GROUP
function drawAgeBarChart(data) {
  var container = document.getElementById("ageChart");
  d3.select(container).html("");

  if (!data.length) {
    container.innerHTML = "<p class='empty-state'>No data for current filter selection.</p>";
    return;
  }

  var width  = Math.max(container.clientWidth || 880, 500);
  var height = 420;
  var margin = { top: 20, right: 20, bottom: 60, left: 80 };

  var svg = d3.select(container).append("svg")
    .attr("width", width).attr("height", height);

  var x = d3.scaleBand()
    .domain(data.map(function (d) { return d.ageGroup; }))
    .range([margin.left, width - margin.right])
    .padding(0.25);

  var y = d3.scaleLinear()
    .domain([0, d3.max(data, function (d) { return d.injuries; })]).nice()
    .range([height - margin.bottom, margin.top]);

  // Gridlines
  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).tickSize(-(width - margin.left - margin.right)).tickFormat("").ticks(6))
    .call(function (g) {
      g.select(".domain").remove();
      g.selectAll("line").attr("stroke", "#2a3349").attr("stroke-dasharray", "3,3");
    });

  var colorScale = d3.scaleOrdinal()
    .domain(data.map(function (d) { return d.ageGroup; }))
    .range(palette);

  var tooltip = d3.select("#tooltip");

  svg.selectAll(".bar")
    .data(data).enter().append("rect")
    .attr("class", "bar")
    .attr("x",      function (d) { return x(d.ageGroup); })
    .attr("y",      function (d) { return y(d.injuries); })
    .attr("width",  x.bandwidth())
    .attr("height", function (d) { return y(0) - y(d.injuries); })
    .attr("rx", 4)
    .attr("fill", function (d) { return colorScale(d.ageGroup); })
    .on("mouseover", function (event, d) {
      tooltip.style("display", "block")
        .html("<strong>" + d.ageGroup + "</strong><br>Injuries: " + d3.format(",")(d.injuries));
    })
    .on("mousemove", function (event) {
      tooltip.style("left", (event.clientX + 14) + "px").style("top", (event.clientY + 14) + "px");
    })
    .on("mouseout", function () { tooltip.style("display", "none"); });

  // Axes
  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-30)")
    .style("text-anchor", "end");

  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).tickFormat(d3.format(",")).ticks(6));

  // Axis labels
  svg.append("text").attr("x", width / 2).attr("y", height - 8)
    .attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#8892a4")
    .text("Age Group");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -(height / 2)).attr("y", 18)
    .attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#8892a4")
    .text("Count of Injuries");
}
