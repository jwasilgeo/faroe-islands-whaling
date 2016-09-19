require([
  'esri/Color',
  'esri/graphicsUtils',
  'esri/layers/CSVLayer',
  'esri/map',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/renderers/SimpleRenderer',
  'dojo/domReady!'
], function(
  Color, graphicsUtils, CSVLayer, Map, SimpleMarkerSymbol, SimpleLineSymbol, SimpleRenderer
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

  var map = new Map('map', {
    basemap: 'hybrid',
    center: [-6.93, 61.91],
    zoom: 9,
    showInfoWindowOnClick: false
  });

  // create the layer for the location center points
  var csvLocationsLayer = new CSVLayer('resources/FaroeWhaling.csv');
  var whiteFill = new Color([255, 255, 255]);
  var blackOutline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([48, 48, 48]), 1);
  var marker = new SimpleMarkerSymbol('solid', 10, blackOutline, whiteFill);
  var renderer = new SimpleRenderer(marker);
  csvLocationsLayer.setRenderer(renderer);
  map.addLayer(csvLocationsLayer);

  // create the thematic layer of whale counts
  var csvThematicLayer = new CSVLayer('resources/FaroeWhaling.csv', {
    copyright: 'www.hagstova.fo',
    id: 'csvLayer',
    fields: [{
      name: 'year',
      type: 'Number'
    }, {
      name: 'whales',
      type: 'Number'
    }, {
      name: 'hunts',
      type: 'Number'
    }, {
      name: 'skinn_values',
      type: 'Number'
    }]
  });

  var purpleFill = new Color([178, 0, 255, 0.4]);
  var orangeOutline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 124, 0]), 1);
  var thematicMarker = new SimpleMarkerSymbol('solid', 15, orangeOutline, purpleFill);
  var thematicRenderer = new SimpleRenderer(thematicMarker);
  var quantize = d3.scale.quantize().domain([0, 100]).range(d3.range(121));
  thematicRenderer.setSizeInfo({
    field: 'whales',
    // minSize: 0,
    // maxSize: 100,
    // minDataValue: 0,
    // maxDataValue: 200,
    stops: [{
      value: 0,
      size: quantize(0)
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
  });
  csvThematicLayer.setRenderer(thematicRenderer);

  map.addLayer(csvThematicLayer);

  csvLocationsLayer.on('click,mouse-move', function(e) {
    var attributes = e.graphic.attributes;
    bayInfo.innerHTML = attributes.whaling_bay;
  });
  csvLocationsLayer.on('mouse-out', function() {
    cleanupInfo();
  });

  csvThematicLayer.on('click,mouse-move', function(e) {
    var attributes = e.graphic.attributes;
    bayInfo.innerHTML = attributes.whaling_bay + ', ' + attributes.year;
    whalesInfo.innerHTML = attributes.whales + ' whales';
    huntsInfo.innerHTML = attributes.hunts + ' hunts ';
    skinnInfo.innerHTML = attributes.skinn_values + ' skinn';
  });
  csvThematicLayer.on('mouse-out', function() {
    cleanupInfo();
  });

  map.on('layer-add', function(e) {
    if (e.layer.id === 'csvLayer') {
      setYear(1996);
      bayInfo.innerHTML = instructionalText;
      document.getElementById('mapControls').style.display = 'block';
      e.target.setExtent(graphicsUtils.graphicsExtent(e.layer.graphics), true);
    }
  });

  function cleanupInfo() {
    bayInfo.innerHTML = instructionalText;
    whalesInfo.innerHTML = '';
    huntsInfo.innerHTML = '';
    skinnInfo.innerHTML = '';
  };


  function setYear(year) {
    yearInfo.innerHTML = year;

    year = Number(year);
    var sumWhales = 0;
    csvThematicLayer.graphics.forEach(function(g) {
      if (g.attributes.year === year) {
        g.show();
        sumWhales += g.attributes.whales;
      } else {
        g.hide();
      }
    });

    totalInfo.innerHTML = sumWhales + ' whales';
  };

});
