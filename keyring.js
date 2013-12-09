var Ring = function(ringData, parentRing) {
	this.ring = ringData;
	this.key = null;
	this.parentRing = parentRing || null;

	this.subrings = [];
	for(var i in this.ring.subrings) {
		this.subrings[ringData.subrings[i].name] = new Ring(ringData.subrings[i], this);
	}

	return this;
};

Ring.prototype = {
	get name() {
		return this.ring.name;
	},

	get fullname() {
		if(this.parentRing)
			return this.parentRing.fullname + "/" + this.ring.name;
		else
			return this.ring.name;
	}
};

Ring.Utils = {};

Ring.Utils.sha256 = function(data) {
	var md = forge.md.sha256.create();
	md.update(data);
	return md.digest().toHex();
};

Ring.Utils.aesDecode = function(data, key) {
	var cipher = forge.aes.createDecryptionCipher(key, 'CBC');
	var iv = data.slice(0, 16);
	cipher.start(iv);
	cipher.update(forge.util.createBuffer(data.slice(16)));
	cipher.finish();
	return cipher.output.getBytes();
};

Ring.Utils.aesEncode = function(data, key) {
	var cipher = forge.aes.createEncryptionCipher(key, 'CBC');
	var iv = forge.random.getBytesSync(16);
	cipher.start(iv);
	cipher.update(forge.util.createBuffer(data));
	cipher.finish();
	return iv + cipher.output.bytes();
};

Ring.prototype.findRing = function(fullname) {
	if(this.ring.name == fullname)
		return this;

	var i = fullname.indexOf("/");
	if(i == -1 || fullname.substr(0,i) != this.ring.name)
		return null;

	fullname = fullname.substr(i+1);
	i = fullname.indexOf("/");
	if(i == -1)
		return this.subrings[fullname];
	else
		return this.subrings[fullname.substr(0,i)].findRing(fullname);
};

Ring.prototype.openWithPassword = function(password, recursive) {
	var key = forge.pkcs5.pbkdf2(password, forge.util.decode64(this.ring.salt), 1000, 32);
	if(this.openWithKey(key))
		return this;

	if(recursive) {
		for(var i in this.subrings) {
			var sr = this.subrings[i].openWithPassword(password, recursive);
			if(sr)
				return sr;
		}
	}

	return null;
};

Ring.prototype.openWithKey = function(key) {
	if(Ring.Utils.sha256(key) == this.ring.signature) {
		this.key = key;
		return this;
	}
	return null;
};

Ring.prototype.openFromParent = function() {
	if(!this.parentRing)
		return false;
	if(!this.parentRing.key)
		if(!this.parentRing.openFromParent())
			return false;

	for(var item in this.parentRing.decodeItems()) {
		if(item.type == "subring" && item.name == this.ring.name) {
			return this.openWithKey(forge.util.decode64(item.key));
		}
	}

	return false;
};

Ring.prototype.decodeItems = function(recursive) {
	for(var item of this.ring.items) {
		yield JSON.parse(Ring.Utils.aesDecode(forge.util.decode64(item), this.key));
	}

	if(recursive) {
		for(var i in this.subrings) {
			var subring = this.subrings[i];
			if(!subring.key && subring.openFromParent()) {
				for(var item in subring.decodeItems(recursive))
					yield item;
			}
		}
	}
};
