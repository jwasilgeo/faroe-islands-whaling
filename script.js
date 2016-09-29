require([
  'esri/layers/CSVLayer',
  'esri/Map',
  'esri/renderers/SimpleRenderer',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/views/MapView',

  'd3/d3.v3.min',
  'c3/c3.min',

  'dojo/domReady!'
], function(
  CSVLayer, Map, SimpleRenderer, SimpleMarkerSymbol, MapView,
  d3, c3
) {
  var yearSlider = document.getElementById('yearSlider');
  yearSlider.addEventListener('input', function(e) {
    setYear(e.target.value);
  });
  var instructionalText = 'Interact with a harbor to learn more.';
  var bayInfo = document.getElementById('bayInfo');
  var whalesInfo = document.getElementById('whalesInfo');
  var huntsInfo = document.getElementById('huntsInfo');
  var skinnInfo = document.getElementById('skinnInfo');
  var yearInfo = document.getElementById('yearInfo');
  var totalInfo = document.getElementById('totalInfo');

  var map = new Map({
    basemap: 'hybrid'
  });

  var mapView = new MapView({
    container: 'viewDiv',
    map: map,
    center: [-6.93, 61.91],
    zoom: 9
  });

  // create the layer for the location center points
  // var csvLocationsLayer = new CSVLayer({
  //   url: 'resources/FaroeWhaling.csv',
  //   renderer: new SimpleRenderer({
  //     symbol: new SimpleMarkerSymbol({
  //       size: '10px',
  //       color: [255, 255, 255],
  //       outline: {
  //         color: [48, 48, 48],
  //         width: 1
  //       }
  //     })
  //   })
  // });
  // map.add(csvLocationsLayer);

  // create the thematic layer of whale counts
  var quantize = d3.scale.quantize().domain([0, 100]).range(d3.range(121));
  var csvThematicLayer = new CSVLayer({
    copyright: 'www.hagstova.fo',
    url: 'resources/FaroeWhaling.csv',
    id: 'csvThematicLayer',
    fields: [{
      name: 'whaling_bay',
      type: 'string'
    }, {
      name: 'year',
      type: 'integer'
    }, {
      name: 'hunts',
      type: 'double'
    }, {
      name: 'whales',
      type: 'double'
    }, {
      name: 'skinn_values',
      type: 'double'
    }],
    renderer: new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        // size: 0,
        color: [178, 0, 255, 0.4],
        outline: {
          color: [255, 124, 0],
          width: 1
        }
      }),
      visualVariables: [{
        type: 'size',
        field: 'whales',
        stops: [{
          value: 0,
          size: quantize(9)
        }, {
          value: 1,
          size: quantize(10) + 10
        }, {
          value: 25,
          size: quantize(25)
        }, {
          value: 50,
          size: quantize(50)
        }, {
          value: 75,
          size: quantize(75)
        }, {
          value: 100,
          size: quantize(100)
        }]
      }]
    })
  });

  map.add(csvThematicLayer);

  var csvLayerView,
    csvLayerViewGraphics,
    chartData = {},
    chart;
  mapView.on('layerview-create', function(e) {
    if (e.layer.id === 'csvThematicLayer') {
      csvLayerView = e.layerView;

      bayInfo.innerHTML = instructionalText;
      document.getElementById('mapControls').style.display = 'block';

      // get access to all the graphics
      csvLayerView.queryGraphics().then(function(graphics) {
        csvLayerViewGraphics = graphics;

        csvLayerViewGraphics.forEach(function(graphic) {
          if (!chartData.hasOwnProperty(graphic.attributes.year)) {
            chartData[graphic.attributes.year] = {};
            chartData[graphic.attributes.year].whaleTotal = 0;
            chartData[graphic.attributes.year].huntTotal = 0;
          };
          chartData[graphic.attributes.year].whaleTotal += graphic.attributes.whales;
          chartData[graphic.attributes.year].huntTotal += graphic.attributes.hunts;
        });

        chart = c3.generate({
          bindTo: '#chart',
          data: {
            x: 'x',
            columns: [
              ['x'].concat(Object.keys(chartData)),
              ['whales'].concat(Object.keys(chartData).map(function(year) {
                return (chartData[year].whaleTotal)
              })),
              // ['hunts'].concat(Object.keys(chartData).map(function(year) {
              //   return (chartData[year].huntTotal)
              // }))
            ],
            axes: {
              whales: 'y',
              hunts: 'y2'
            },
            type: 'spline',
            colors: {
              whales: '#000000',
              hunts: '#ffffff'
            },
            selection: {
              enabled: true
            },
            onclick: function(d) {
              yearSlider.value = d.x;
              setYear(d.x);
            }
          },
          axis: {
            x: {
              show: false
            },
            y: {
              show: false
            },
            y2: {
              show: false
            }
          },
          point: {
            show: false,
            select: {
              r: 3.5
            }
          },
          legend: {
            show: false
          },
          tooltip: {
            show: false
          },
          size: {
            height: 75,
            width: 220
          }
        });

        setYear(1996);

      });
    }
  });

  mapView.on("click", function(evt) {
    var screenPoint = evt.screenPoint;
    mapView.hitTest(screenPoint).then(function(response) {
      var graphic = response.results[0].graphic;

      bayInfo.innerHTML = graphic.attributes.whaling_bay + ', ' + graphic.attributes.year;
      whalesInfo.innerHTML = graphic.attributes.whales + ' whales';
      huntsInfo.innerHTML = graphic.attributes.hunts + ' hunts ';
      skinnInfo.innerHTML = graphic.attributes.skinn_values + ' skinn';
    });
  });

  function setYear(year) {
    yearInfo.innerHTML = year;

    year = Number(year);

    // toggle graphic visibility and add up the year's total whales
    var sumWhales = 0;
    csvLayerViewGraphics.forEach(function(g) {
      if (g.attributes.year === year) {
        g.visible = true;
        sumWhales += g.attributes.whales;
      } else {
        g.visible = false;
      }
    });

    totalInfo.innerHTML = sumWhales + ' whales';

    // workaround to "refresh" the csv layer view after changing graphic properties
    csvLayerView.visible = false;
    setTimeout(function() {
      csvLayerView.visible = true;
    }, 5);

    chart.select(['whales'], [Object.keys(chartData).indexOf(String(year))], true);
  };

  // csvLocationsLayer.on('click,mouse-move', function(e) {
  //   var attributes = e.graphic.attributes;
  //   bayInfo.innerHTML = attributes.whaling_bay;
  // });
  // csvLocationsLayer.on('mouse-out', function() {
  //   cleanupInfo();
  // });
  //
  // csvThematicLayer.on('click,mouse-move', function(e) {
  //   var attributes = e.graphic.attributes;
  //   bayInfo.innerHTML = attributes.whaling_bay + ', ' + attributes.year;
  //   whalesInfo.innerHTML = attributes.whales + ' whales';
  //   huntsInfo.innerHTML = attributes.hunts + ' hunts ';
  //   skinnInfo.innerHTML = attributes.skinn_values + ' skinn';
  // });
  // csvThematicLayer.on('mouse-out', function() {
  //   cleanupInfo();
  // });
  //
  // function cleanupInfo() {
  //   bayInfo.innerHTML = instructionalText;
  //   whalesInfo.innerHTML = '';
  //   huntsInfo.innerHTML = '';
  //   skinnInfo.innerHTML = '';
  // };

});
