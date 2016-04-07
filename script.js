var balloonHtml = [
    '<div class="balloon js-baloon">',
        '<div class="balloon-pic">',
            '<div class="img"></div>',
        '</div>',
        '<div class="balloon-title">ГК «СКАНЭКС»</div>',
        '<div class="balloon-content">',
            '<p>',
                '142784, г. Москва, Киевское шоссе, 1, Бизнес-парк «Румянцево», корп.А, 8 подъезд, офис 732',
            '</p>',
            '<p>',
                'Телефон: <a class="phone" href="tel:+74957397385">+7 <span>(495)</span> 739-73-85</a><br>',
                '<a href="mailto:info@scanex.ru">info@scanex.ru</a>',
            '</p>',
        '</div>',
    '</div>'
].join('\n');

function setLeafletMarkerIcon() {
    L.Icon.Default = L.Icon.Default.extend({
        options: {
            iconUrl: 'user/map-pin.png',
            iconSize: [61, 58],
            iconAnchor: [25, 58],
            popupAnchor: [0, 0],
            shadowUrl: 'user/map-pin.png',
            shadowSize: [0, 0],
            shadowAnchor: [0, 0]
        }
    });

    L.Icon.Default.imagePath = 'user';

    L.Marker = L.Marker.extend({
        options: {
            icon: new L.Icon.Default()
        }
    });
}

function runUserScript(cm) {
    // TODO: add script here
    // you can get components via component manager
    // like this:

    var baseLayersManager = cm.get('baseLayersManager');
    var layersTree = cm.get('layersTree');
    var layersHash = cm.get('layersHash');
    var container = cm.get('container');
    var config = cm.get('config');
    var map = cm.get('map');

    setLeafletMarkerIcon();

    baseLayersManager.setActiveIDs(['hybrid']).setCurrentID('hybrid');

    var center = config.state.map.position;
    var marker = L.marker([center.y, center.x]).addTo(map);
    marker.bindPopup(balloonHtml);
    marker.openPopup();
}
