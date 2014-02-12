var Ring = function(ringData, parentRing) {
	this.ring = ringData;
	this.key = null;
	this.parentRing = parentRing || null;

	this.subrings = [];
	for(var i in this.ring.subrings) {
		this.subrings.push(new Ring(this.ring.subrings[i], this));
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

Ring.Utils.derivateKey = function(password, salt) {
	return forge.pkcs5.pbkdf2(password, salt, 1000, 32);
};

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

Ring.prototype.openWithPassword = function(password, recursive) {
	var key = Ring.Utils.derivateKey(password, forge.util.decode64(this.ring.salt));
	if(this.openWithKey(key))
		return this;

	if(recursive) {
		this.subrings.forEach(function(sr) {
			sr = sr.openWithPassword(password, recursive);
			if(sr)
				return sr;
		});
	}

	return null;
};

Ring.prototype.openWithKey = function(key, recursive) {
	if(Ring.Utils.sha256(key) == this.ring.signature) {
		this.key = key;
		return this;
	}

	if(recursive) {
		this.subrings.forEach(function(sr) {
			sr = sr.openWithKey(key, recursive);
			if(sr)
				return sr;
		});
	}

	return null;
};

Ring.prototype.openFromParent = function() {
	if(!this.parentRing)
		return false;
	if(!this.parentRing.key)
		if(!this.parentRing.openFromParent())
			return false;

	for(var i in this.parentRing.ring.items) {
		var item = this.parentRing.decodeItem(this.parentRing.ring.items[i]);
		if(item.type == "subring" && Ring.Utils.sha256(forge.util.decode64(item.key)) == this.ring.signature) {
			return this.openWithKey(forge.util.decode64(item.key));
		}
	}

	return false;
};

Ring.prototype.decodeItem = function(item) {
	return JSON.parse(Ring.Utils.aesDecode(forge.util.decode64(item), this.key));
};

Ring.prototype.encodeItem = function(item) {
	return forge.util.encode64(Ring.Utils.aesEncode(JSON.stringify(item), this.key));
}
