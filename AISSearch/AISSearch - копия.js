﻿(function() {
    var pluginName = 'AISSearch',
        serverPrefix = serverBase || 'http://maps.kosmosnimki.ru/',
        serverScript = serverPrefix + 'VectorLayer/Search.ashx';

    _translationsHash.addtext('rus', {
        'AISSearch.title' : 'Поиск кораблей',
        'AISSearch.title1' : 'Найдено кораблей',
        'AISSearch.title2' : '<b>Данных не найдено!</b>',
        'AISSearch.error' : '<b>Ошибка при получении данных!</b>',
        'AISSearch.iconTitle' : 'Поиск кораблей по экрану',
        'AISSearch.placeholder_0' : 'Поиск по адресам, координатам',
        'AISSearch.placeholder_1' : 'Поиск судна по названию / MMSI'
        // 'AISSearch.placeholder_1' : 'Поиск судна по названию / MMSI. Поиск по адресам, координатам, кадастровым номерам'
    });
    _translationsHash.addtext('eng', {
        'AISSearch.title' : 'Searching vessels',
        'AISSearch.title1' : 'Vessels found',
        'AISSearch.title2' : '<b>Vessels not found!</b>',
        'AISSearch.error' : '<b>Vessels not found!</b>',
        'AISSearch.iconTitle' : 'Search vessels within the view area',
        'AISSearch.placeholder_0' : 'Search for addresses, coordinates',
        'AISSearch.placeholder_1' : 'Search by vessel name / MMSI'
        // 'AISSearch.placeholder_1' : 'Search by vessel name / MMSI. Search by addresses, coordinates, cadastre number'
    });
    
    var publicInterface = {
        pluginName: pluginName,
        afterViewer: function(params, map) {
            var path = gmxCore.getModulePath(pluginName);
            var _params = $.extend({
                regularImage: 'ship.png',
                activeImage: 'active.png',
                layerName: null
            }, params);

            var searchControl = 'getSearchControl' in window.oSearchControl ? window.oSearchControl.getSearchControl() : null;
            var placeholderDefault = searchControl ? searchControl.GetSearchString() : _gtxt(pluginName + '.placeholder_0');
            var layerName = _params.layerName;
            
            var searchBorder = {},
                lmap, layersByID;
            if (!nsGmx.leafletMap) {    // для старого АПИ
                gmxCore.loadScript(serverPrefix + 'api/leaflet/plugins/Leaflet-GeoMixer/src/Deferred.js')
                lmap = gmxAPI._leaflet.LMap;
                layersByID = gmxAPI.map.layers;
            } else {
                lmap = nsGmx.leafletMap;
                layersByID = nsGmx.gmxMap.layersByID;
            }

            var aisLayerID = '8EE2C7996800458AAF70BABB43321FA4',
                aisLayer = layersByID[aisLayerID],
                tracksLayerID = params.tracksLayerID || '13E2051DFEE04EEF997DC5733BD69A15',
                tracksLayer = layersByID[tracksLayerID],
                sideBar = L.control.gmxSidebar({className: 'aissearch'});
                div = L.DomUtil.create('div', pluginName + '-content'),
                shap = L.DomUtil.create('div', '', div),
                title = L.DomUtil.create('span', '', shap),
                exportIcon = L.DomUtil.create('a', 'icon-export', shap),
                refresh = L.DomUtil.create('i', 'icon-refresh', shap),
                bboxInfo = L.DomUtil.create('div', pluginName + '-bboxInfo', div),
                node = null,
                file = 'test.csv',
                blob = null,
                trs = [];

            refresh.title = 'Обновить';

            exportIcon.setAttribute('target', '_blank');  
            exportIcon.title = 'Экспорт в CSV';
            if (navigator.msSaveBlob) { // IE 10+
               exportIcon.addEventListener("click", function() {
                    navigator.msSaveBlob(blob, file);
                }, false);
            }

            publicInterface.setMMSI = function(mmsiArr, bbox) {
                if (bbox) { lmap.fitBounds(bbox, {maxZoom: 11}); }
                if (!nsGmx.leafletMap) {    // для старого АПИ
                    var st = mmsiArr.length ? '(' + mmsiArr.join(',') + ')' : '';
                    if (aisLayer) {
                        aisLayer.setVisibilityFilter(st ? '[mmsi] in ' + st : '');
                        aisLayer.setVisible(true);
                    }
                    if (tracksLayer) {
                        tracksLayer.setVisibilityFilter(st ? '[MMSI] in ' + st : '');
                        tracksLayer.setVisible(true);
                    }
                } else {
                    var filterFunc = function(args) {
                        var mmsi = args.properties[1];
                        for (var i = 0, len = mmsiArr.length; i < len; i++) {
                            if (mmsi === mmsiArr[i]) { return true; }
                        }
                        return false;
                    };
                    if (aisLayer) {
                        if (mmsiArr.length) {
                            aisLayer.setFilter(filterFunc);
                        } else {
                            aisLayer.removeFilter();
                        }
                        if (!aisLayer._map) {
                            lmap.addLayer(aisLayer);
                        }
                    }
                    if (tracksLayer) {
                        if (mmsiArr.length) {
                            tracksLayer.setFilter(filterFunc);
                        } else {
                            tracksLayer.removeFilter();
                        }
                        if (!tracksLayer._map) {
                            lmap.addLayer(tracksLayer);
                        }
                    }
                }
            };

            function getBorder() {
                var dFeatures = nsGmx.leafletMap.gmxDrawing.getFeatures();
                if (dFeatures.length) { return dFeatures[dFeatures.length - 1].toGeoJSON(); }
                var latLngBounds = lmap.getBounds(),
                    sw = latLngBounds.getSouthWest(),
                    ne = latLngBounds.getNorthEast();
                    min = {x: sw.lng, y: sw.lat},
                    max = {x: ne.lng, y: ne.lat},
                    minX = min.x,
                    maxX = max.x,
                    geo = {type: 'Polygon', coordinates: [[[minX, min.y], [minX, max.y], [maxX, max.y], [maxX, min.y], [minX, min.y]]]},
                    w = (maxX - minX) / 2;

                if (w >= 180) {
                    geo = {type: 'Polygon', coordinates: [[[-180, min.y], [-180, max.y], [180, max.y], [180, min.y], [-180, min.y]]]};
                } else if (maxX > 180 || minX < -180) {
                    var center = ((maxX + minX) / 2) % 360;
                    if (center > 180) { center -= 360; }
                    else if (center < -180) { center += 360; }
                    minX = center - w; maxX = center + w;
                    if (minX < -180) {
                        geo = {type: 'MultiPolygon', coordinates: [
                            [[[-180, min.y], [-180, max.y], [maxX, max.y], [maxX, min.y], [-180, min.y]]],
                            [[[minX + 360, min.y], [minX + 360, max.y], [180, max.y], [180, min.y], [minX + 360, min.y]]]
                        ]};
                    } else if (maxX > 180) {
                        geo = {type: 'MultiPolygon', coordinates: [
                            [[[minX, min.y], [minX, max.y], [180, max.y], [180, min.y], [minX, min.y]]],
                            [[[-180, min.y], [-180, max.y], [maxX - 360, max.y], [maxX - 360, min.y], [-180, min.y]]]
                        ]};
                    }
                }
                return geo;
            };

            function getMMSIoptions(str) {
                exportIcon.style.visibility = 'hidden';

                var cont = sideBar.getContainer();
                L.DomEvent.disableScrollPropagation(cont);
                cont.appendChild(div);
                title.innerHTML = _gtxt(pluginName + '.title');
                
                aisLayerID = params.aisLayerID || '8EE2C7996800458AAF70BABB43321FA4';    // по умолчанию поиск по слою АИС 
                if (!layersByID[aisLayerID]) {
                    console.log('Отсутствует слой: АИС данные `' + aisLayerID + '`');
                   return;
                }
                aisLayer = layersByID[aisLayerID];
                tracksLayer = layersByID[tracksLayerID];

                var dateInterval = nsGmx.widgets.commonCalendar.getDateInterval(),
                    dt1 = dateInterval.get('dateBegin'),
                    dt2 = dateInterval.get('dateEnd'),
                    prop = (aisLayer._gmx ? aisLayer._gmx : aisLayer).properties,
                    TemporalColumnName = prop.TemporalColumnName,
                    columns = '{"Value":"mmsi"},{"Value":"vessel_name"},{"Value":"count(*)", "Alias":"count"}';

                columns += ',{"Value":"min(STEnvelopeMinX([GeomixerGeoJson]))", "Alias":"xmin"}';
                columns += ',{"Value":"max(STEnvelopeMaxX([GeomixerGeoJson]))", "Alias":"xmax"}';
                columns += ',{"Value":"min(STEnvelopeMinY([GeomixerGeoJson]))", "Alias":"ymin"}';
                columns += ',{"Value":"max(STEnvelopeMaxY([GeomixerGeoJson]))", "Alias":"ymax"}';
                L.DomUtil.addClass(refresh, 'animate-spin');

                var query = "(";
                query += "(["+TemporalColumnName+"] >= '" + dt1.toJSON() + "')";
                query += " and (["+TemporalColumnName+"] < '" + dt2.toJSON() + "')";
                if (str) {
                    if (str.search(/[^\d, ]/) === -1) {
                        var arr = str.replace(/ /g, '').split(/,/);
                        query += " and ([mmsi] IN (" + arr.join(',') + "))";
                    } else {
                        query += " and ([vessel_name] contains '" + str + "')";
                    }
                }
                query += ")";

                searchBorder = getBorder();
                var reqParams = {
                    WrapStyle: 'window',
                    border: JSON.stringify(searchBorder),
                    border_cs: 'EPSG:4326',
                    // out_cs: 'EPSG:3395',
                    //pagesize: 100,
                    //orderdirection: 'desc',
                    orderby: 'vessel_name',
                    layer: aisLayerID,
                    columns: '[' + columns + ']',
                    groupby: '[{"Value":"mmsi"},{"Value":"vessel_name"}]',
                    query: query
                };
                L.gmxUtil.sendCrossDomainPostRequest(serverScript,
                  reqParams,
                  function(json) {
                    L.DomUtil.removeClass(refresh, 'animate-spin');
                    if (json && json.Status === 'ok' && json.Result) {
                        var pt = json.Result,
                            fields = pt.fields,
                            indexes = {};
                        fields.map(function(it, i) {
                            indexes[it] = i;
                        });
                        var values = pt.values;
                        if (node && node.parentNode) {
                            node.parentNode.removeChild(node);
                        }
                        trs = [      // чистка строк таблицы
                            ['#', 'Vessel name', 'MMSI', 'count'].join(';')
                        ];
                        if (values.length) {
                            node = L.DomUtil.create('select', pluginName + '-selectItem selectStyle', div);
                            if (params.height) {
                                node.style.height = params.height + 'px';
                            }
                            node.setAttribute('size', 15);
                            node.setAttribute('multiple', true);
                            var setView = function(fitBoundsFlag) {
                                var bbox = null,
                                    filter = [];
                                    for (var i = 0, len = node.options.length; i < len; i++) {
                                        var it = node.options[i];
                                        if (it.selected) {
                                            filter.push(Number(it.id));
                                            var varr = values[i];
                                            if (fitBoundsFlag) {
                                                bbox = [
                                                    [varr[5], varr[3]],
                                                    [varr[6], varr[4]]
                                                ];
                                            }
                                        }
                                    }
                                publicInterface.setMMSI(filter, bbox);
                            };
                            node.onchange = function() {
                                setView(false);
                            };
                            node.ondblclick = function() {
                                setView(true);
                            };

                            values.map(function(it, i) {
                                var mmsi = it[indexes.mmsi],
                                    name = it[indexes.vessel_name] || mmsi,
                                    count = it[indexes.count],
                                    val = '(' + count + ') ' + name,
                                    opt = L.DomUtil.create('option', '', node);
                                opt.setAttribute('id', mmsi);
                                opt.setAttribute('title', 'mmsi: ' + mmsi);
                                opt.text = val.replace(/\s+$/, '');

                                trs.push([(i + 1), name, mmsi, count].join(';'));
                                return opt;
                            });
                            title.innerHTML = _gtxt(pluginName + '.title1') + ': <b>' + values.length + '</b>';
                            blob = new Blob([trs.join('\n')], {type: "text/csv;charset=utf-8;"});
                            file = 'data_' + Date.now() + '.csv';
                            exportIcon.setAttribute('href', window.URL.createObjectURL(blob));
                            exportIcon.setAttribute('download', file);
                            exportIcon.style.visibility = 'visible';
                        } else {
                            title.innerHTML = _gtxt(pluginName + '.title2');
                        }
                    } else {
                        title.innerHTML = _gtxt(pluginName + '.error');
                    }
                });
                bboxInfo.innerHTML = '(<b>по ' + (searchBorder.type !== 'Feature' ? 'экрану' : 'контуру') + '</b>)';
            }

            L.DomEvent.on(refresh, 'click', function(str) {
                getMMSIoptions();
            }, this);
            var searchHook = function(str) {
                    var res = sideBar && sideBar._map ? true : false;
                    if (res) {
                        getMMSIoptions(str);
                    }
                    return res;
                };
            
            var icon = L.control.gmxIcon({
                id: pluginName, 
                togglable: true,
                regularImageUrl: _params.regularImage.search(/^https?:\/\//) !== -1 ? _params.regularImage : path + _params.regularImage,
                activeImageUrl:  _params.activeImage.search(/^https?:\/\//) !== -1 ? _params.activeImage : path + _params.activeImage,
                title: _gtxt(pluginName + '.iconTitle')
            }).on('statechange', function(ev) {
                var isActive = ev.target.options.isActive;
                if (isActive) {
                    if (searchControl) {
                        searchControl.addSearchByStringHook(searchHook, 1002);
                        if (searchControl.SetPlaceholder) { searchControl.SetPlaceholder(_gtxt(pluginName + '.placeholder_1')); }
                    }
                    lmap.addControl(sideBar);
                    getMMSIoptions();
                } else {
                    if (searchControl) {
                        searchControl.removeSearchByStringHook(searchHook);
                        if (searchControl.SetPlaceholder) { searchControl.SetPlaceholder(placeholderDefault); }
                    }
                    if (sideBar && sideBar._map) {
                        lmap.removeControl(sideBar);
                    }
                    if (!nsGmx.leafletMap) {    // для старого АПИ
                        if (aisLayer) {
                            aisLayer.setVisibilityFilter('');
                            // aisLayer.setVisible(false);
                        }
                        if (tracksLayer) {
                            tracksLayer.setVisibilityFilter('');
                            // tracksLayer.setVisible(false);
                        }
                    } else {
                        if (aisLayer) {
                            aisLayer.removeFilter();
                        }
                        if (tracksLayer) {
                            tracksLayer.removeFilter();
                        }
                    }
                }
            });
            lmap.addControl(icon);
        }
    };
    gmxCore.addModule(pluginName, publicInterface, {
        css: pluginName + '.css'
    });
})();