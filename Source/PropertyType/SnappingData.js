function SnappingData(type, pos, applyTo, vertical, id, disabled, limit1, limit2) {
    this.type = type ? type : "";
    this.applyTo = applyTo ? applyTo : "";
    this.vertical = vertical ? true : false;
    this.disabled = disabled;

    if (this.applyTo && typeof(this.applyTo) == "string") {
        this.applyTo = this.applyTo.split(",");
    }
    this.id = id ? id : "";
    this.pos = 0;
    this.limit1 = 0;
    this.limit2 = 0;

    try {
        this.pos = parseInt(pos);
        if (limit1) {
            this.limit1 = parseInt(limit1);
        }
        if (limit2) {
            this.limit2 = parseInt(limit2);
        }
    } catch(e) {
        error("invalid pos: " + pos);
    }
};
/*SnappingData.REG_EX = /^([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|(.+)$/i;
SnappingData.fromString = function(literal) {
    var snapping = new SnappingData();
    if (literal.match(SnappingData.REG_EX)) {
        snapping = new SnappingData(RegExp.$1, RegExp.$2, RegExp.$3, RegExp.$4, RegExp.$5, RegExp.$6);
    }
    return snapping;
};*/
SnappingData.prototype.toString = function () {
    return [this.type, this.pos, this.applyTo, this.vertical, this.limit1, this.limit2].join("|");
};
pencilSandbox.SnappingData = SnappingData;

