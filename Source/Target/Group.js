function Group(canvas, svg) {
    this.svg = svg;
    this.canvas = canvas;

    if (!this.svg.getAttribute("id")) {
        var uuid = Util.newUUID();
        this.svg.setAttribute("id", uuid);
    }
    this.id = this.svg.getAttribute("id");

    this.targets = [];
    var thiz = this;
    Dom.workOn("./svg:g[@p:type]", this.svg, function (node) {
        var controller = thiz.canvas.createControllerFor(node);
        thiz.targets.push(controller);
    });

    var propertyGroup = new PropertyGroup();
    propertyGroup.name = Util.getMessage("shape.properties.label");

    var firstGroups = this.targets[0].getPropertyGroups();

    for (g in firstGroups) {
        for (p in firstGroups[g].properties) {
            var propDef = firstGroups[g].properties[p];

            var ok = true;
            for (var i = 1; i < this.targets.length; i++) {
                var target = this.targets[i];
                var propGroups = target.getPropertyGroups();

                var found = false;
                for (g1 in propGroups) {
                    for (p1 in propGroups[g1].properties) {
                        var def = propGroups[g1].properties[p1];

                        if (propDef.isSimilarTo(def)) {
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }

                if (!found) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            propertyGroup.properties.push(propDef);
        }
    }

    this.propertyGroup = propertyGroup;

    //this.dockingManager = new DockingManager(this);
}
Group.prototype.getName = function () {
    return "Group";
};
Group.prototype.isFor = function (svg) {
    return this.svg == svg;
};
Group.prototype.getProperties = function () {
    var properties = {};
    for (var p in this.propertyGroup.properties) {
        var name = this.propertyGroup.properties[p].name;
        properties[name] = this.getProperty(name);
    }

    return properties;
};
Group.prototype.getPropertyGroups = function () {
    return [this.propertyGroup];
};
Group.prototype.setProperty = function (name, value) {
    for (t in this.targets) {
        this.targets[t].setProperty(name, value);
    }
};
Group.prototype.getProperty = function (name) {
    if (name == "box") return null;
    var firstValue = this.targets[0].getProperty(name);
    if (!firstValue) return null;
    var same = true;
    for (var i = 1; i < this.targets.length; i ++) {
        var target = this.targets[i];
        var value = target.getProperty(name);

        if (value == null) return null;
        if (firstValue.toString() != value.toString()) {
            same = false;
            break;
        }
    }

    return same ? firstValue : null;
};
Group.prototype.setMetadata = function (name, value) {
    return Util.setNodeMetadata(this.svg, name, value);
};
Group.prototype.getMetadata = function (name) {
    return Util.getNodeMetadata(this.svg, name);
};

//new imple for geometry editing

Group.prototype.moveBy = function (dx, dy, targetSet, moving) {
    var matrix = this.svg.ownerSVGElement.createSVGTransform().matrix;
    matrix = matrix.translate(dx, dy);
    var ctm = this.svg.getTransformToElement(this.svg.parentNode);

    matrix = matrix.multiply(ctm);
    Svg.ensureCTM(this.svg, matrix);

    //if (Config.get("docking.enabled")) {
    //   this.dockingManager.handleMoveBy(dx, dy, targetSet, moving);
    //}
};
Group.prototype.scaleTo = function (nw, nh, group) {
    var geo = this.getGeometry();
    var dw = nw / geo.dim.w;
    var dh = nh / geo.dim.h;
    for (t in this.targets) {
        var target = this.targets[t];

        var bounding = target.getBounding(this.svg);
        var newX = bounding.x * dw;
        var newY = bounding.y * dh;

        var targetGeo = target.getGeometry();
        var newW = targetGeo.dim.w * dw;
        var newH = targetGeo.dim.h * dh;

        target.scaleTo(newW, newH, true);

        bounding = target.getBounding(this.svg);
        target.moveBy(newX - bounding.x, newY - bounding.y, true);
    }

    //if (Config.get("docking.enabled")) {
    //    this.dockingManager.handleScaleTo(nw, nh, geo.dim.w, geo.dim.h, group);
    //}
};
Group.prototype.rotateBy = function (da) {
    debug("rotateBy: " + da);
    var ctm = this.svg.getTransformToElement(this.svg.parentNode);
    var bbox = this.svg.getBBox();
    var x = bbox.x + bbox.width / 2;
    var y = bbox.y + bbox.height / 2;

    center = Svg.pointInCTM(x, y, ctm);

    ctm = ctm.translate(x, y);
    ctm = ctm.rotate(da);
    ctm = ctm.translate(0 - x, 0 - y);

    Svg.ensureCTM(this.svg, ctm);

    //if (Config.get("docking.enabled")) {
    //    this.dockingManager.handleRotateBy(da);
    //}
};
Group.prototype.getBounding = function (to) {
    var context = to ? to : this.canvas.drawingLayer;
    var ctm = this.svg.getTransformToElement(context);

    var bbox = this.svg.getBBox();

    var p = Svg.pointInCTM(bbox.x, bbox.y, ctm);
    var rect = {
        x: p.x,
        y: p.y,
        width: 0,
        height: 0
    };

    Svg.expandRectTo(rect, Svg.pointInCTM(bbox.x + bbox.width, bbox.y, ctm));
    Svg.expandRectTo(rect, Svg.pointInCTM(bbox.x + bbox.width, bbox.y + bbox.height, ctm));
    Svg.expandRectTo(rect, Svg.pointInCTM(bbox.x, bbox.y + bbox.height, ctm));

    return rect;
};
Group.prototype.supportScaling = function () {
    return true;
};

Group.prototype.ungroup = function () {
    var nodes = [];
    for (t in this.targets) {
        var target = this.targets[t];

        var node = target.svg;
        var ctm = target.svg.getTransformToElement(this.canvas.drawingLayer);

        node.parentNode.removeChild(node);
        this.canvas.drawingLayer.appendChild(node);

        Svg.ensureCTM(node, ctm);

        nodes.push(node);
    }

    this.canvas.drawingLayer.removeChild(this.svg);

    return nodes;
};

//~new impl

Group.TRANSLATE_REGEX = /^translate\(([\-0-9]+)\,([\-0-9]+)\)$/
Group.prototype.getGeometry = function () {
    var geo = new Geometry();
    geo.ctm = this.svg.getTransformToElement(this.canvas.drawingLayer);

    geo.dim = {};
    var bbox = this.svg.getBBox();
    geo.dim.w = bbox.width;
    geo.dim.h = bbox.height;

    geo.loc = {x: bbox.x, y: bbox.y};

    return geo;
};
Group.prototype.getBoundingRect = function () {
    var rect = null;
    var thiz = this;
    for (t in this.targets) {
        var childRect = this.targets[t].getBoundingRect();
        rect = rect ? Svg.joinRect(rect, childRect) : childRect;
    }

    return rect;
};
Group.prototype.setGeometry = function (geo) {
    var thiz = this;
    for (t in this.targets) {
        var childRect = this.targets[t].getBoundingRect();
        //TODO: impl. this
    }
};

Group.prototype.moveByx = function (x, y, zoomAware) {
    var thiz = this;
    for (t in this.targets) {
        this.targets[t].moveBy(x, y, zoomAware ? true : false);
    }
};


Group.prototype.setPositionSnapshot = function () {
/*
    var ctm = this.svg.getTransformToElement(this.canvas.drawingLayer);

    this.svg.transform.baseVal.consolidate();

    var translate = this.svg.ownerSVGElement.createSVGMatrix();
    translate.e = 0;
    translate.f = 0;

    translate = this.svg.transform.baseVal.createSVGTransformFromMatrix(translate);
    this.svg.transform.baseVal.appendItem(translate);

*/
    this._pSnapshot = {lastDX: 0, lastDY: 0};
};
Group.prototype.moveFromSnapshot = function (dx, dy, dontNormalize, targetSet) {
/*
    var v = Svg.vectorInCTM({x: dx, y: dy},
                            this._pSnapshot.ctm,
                            true);

    var snap = Config.get("edit.snap.grid", true);
    if (!dontNormalize && snap) {
        var grid = Pencil.getGridSize();
        newX = Util.gridNormalize(v.x + this._pSnapshot.x, grid.w);
        newY = Util.gridNormalize(v.y + this._pSnapshot.y, grid.h);

        v.x = newX - this._pSnapshot.x;
        v.y = newY - this._pSnapshot.y;
    }

    this._pSnapshot.translate.matrix.e = v.x;
    this._pSnapshot.translate.matrix.f = v.y;
*/

    this.moveBy(dx - this._pSnapshot.lastDX, dy - this._pSnapshot.lastDY, targetSet);
    this._pSnapshot.lastDX = dx;
    this._pSnapshot.lastDY = dy;
};
Group.prototype.clearPositionSnapshot = function () {
/*
    delete this._pSnapshot;
    this._pSnapshot = null;
    this.svg.transform.baseVal.consolidate();
*/
    this._pSnapshot = {lastDX: 0, lastDY: 0};
};

Group.prototype.deleteTarget = function () {
    this.canvas.snappingHelper.updateSnappingGuide(this, true);
    //this.dockingManager.deleteTarget();
    this.svg.parentNode.removeChild(this.svg);
};
Group.prototype.bringForward = function () {
    try {
        var next = this.svg.nextSibling;
        if (next) {
            var parentNode = this.svg.parentNode;
            parentNode.removeChild(this.svg);
            var next2 = next.nextSibling;
            if (next2) {
                parentNode.insertBefore(this.svg, next2);
            } else {
                parentNode.appendChild(this.svg);
            }
            //this.dockingManager.invalidateChildTargets();
        }
    } catch (e) { alert(e); }
};
Group.prototype.bringToFront = function () {
    try {
        var next = this.svg.nextSibling;
        if (next) {
            var parentNode = this.svg.parentNode;
            parentNode.removeChild(this.svg);
            parentNode.appendChild(this.svg);
            //this.dockingManager.invalidateChildTargets();
        }
    } catch (e) { alert(e); }
};
Group.prototype.sendBackward = function () {
    try {
        var previous = this.svg.previousSibling;
        if (previous) {
            var parentNode = this.svg.parentNode;
            parentNode.removeChild(this.svg);
            parentNode.insertBefore(this.svg, previous);
            //this.dockingManager.invalidateChildTargets();
        }
    } catch (e) { alert(e); }
};
Group.prototype.sendToBack = function () {
    try {
        var previous = this.svg.previousSibling;
        if (previous) {
            var parentNode = this.svg.parentNode;
            parentNode.removeChild(this.svg);
            parentNode.insertBefore(this.svg, parentNode.firstChild);
            //this.dockingManager.invalidateChildTargets();
        }
    } catch (e) { alert(e); }
};
Group.prototype.getTextEditingInfo = function () {
    var info = null;
    return info;
};

Group.prototype.createTransferableData = function () {
    return {type: ShapeXferHelper.MIME_TYPE,
            isSVG: true,
            dataNode: this.svg.cloneNode(true)
           };
};
Group.prototype.lock = function () {
    this.svg.setAttributeNS(PencilNamespaces.p, "p:locked", "true");
};

Group.prototype.markAsMoving = function (moving) {
    //this.dockingManager.moving = moving;
    Svg.optimizeSpeed(this.svg, moving);
};

Group.prototype.getSnappingGuide = function () {
    var b = this.getBounding();

    var vertical = [];
    var horizontal = [];

    vertical.push(new SnappingData("Left", b.x, "Left", true, this.id, false, b.y, b.y + b.height));
    vertical.push(new SnappingData("VCenter", b.x + b.width/2, "VCenter", true, this.id, false, b.y, b.y + b.height));
    vertical.push(new SnappingData("Right", b.x + b.width, "Right", true, this.id, false, b.y, b.y + b.height));

    horizontal.push(new SnappingData("Top", b.y, "Top", false, this.id, false, b.x, b.x + b.width));
    horizontal.push(new SnappingData("HCenter", b.y + b.height/2, "HCenter", false, this.id, false, b.x, b.x + b.width));
    horizontal.push(new SnappingData("Bottom", b.y + b.height, "Bottom", false, this.id, false, b.x, b.x + b.width));

    return {
        vertical: vertical, horizontal: horizontal
    }
};
