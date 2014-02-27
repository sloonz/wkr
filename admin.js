$(function() {
	var currentRing = null;

	$("#toggle-recursive").click(function() {
		if($("#toggle-recursive").hasClass("btn-default")) {
			$("#toggle-recursive").removeClass("btn-default");
			$("#toggle-recursive").addClass("btn-success");
			$(".recursive").css("display", "table-row");
		} else {
			$("#toggle-recursive").addClass("btn-default");
			$("#toggle-recursive").removeClass("btn-success");
			$(".recursive").hide();
		}
	});

	$("#add-item").click(function(){
		clear();
		$("#panel").show();
		$("#item-form").unbind('submit');
		$("#item-form").submit(function(){
			wkr.submitItem(currentRing, null, function() {
				wkr.selectRing(currentRing);
			});
		});
	});

	$(".close-panel").click(function() {
		$("#panel").hide();
	});

	$("#sign-out").click(function(){
		sessionStorage.removeItem("wkrCredentials");
		localStorage.removeItem("wkrCredentials");
		window.location.reload();
	});

	$("#create-account").click(function(){
		var auth = wkr.getAuthForm();
		if(auth) {
			getSalt(function(salt) {
				var key = Ring.Utils.derivateKey(auth.password, salt);
				wkr.keyringCred = { id: Ring.Utils.sha256(auth.login), key: key };
				var data = {
					"action": "create",
				"name": prompt('Enter root ring name'),
				"salt": forge.util.encode64(salt),
				"signature": Ring.Utils.sha256(key)
				};
				wkr.ajax(data, function(resp) {
					if(resp.result == "error") {
						if(resp.error == "existing") {
							alert('This account already exists');
						} else {
							alert('Unknown error : ' + resp.error);
						}
						return;
					}

					wkr.doLogin(null, auth.password, auth.rememberType);
				});
			});
		}
	});

	$("#create-subring").click(function(){
		var name = prompt('Enter ring name');
		var password = prompt('Enter ring password');
		var tryCreate = function(salt, nonce) {
			var key = Ring.Utils.derivateKey(password, salt);
			var associatedItem = currentRing.encodeItem({type:"subring", key:forge.util.encode64(key)});
			var data = [];
			data.push({action: "add-item", data: associatedItem, signature: currentRing.ring.signature});
			data.push({action: "add-subring", name: name, signature: Ring.Utils.sha256(key), salt: forge.util.encode64(slt), parent_signature: currentRing.ring.signature});

			if(nonce) {
				data[0].wkrNonce = forge.util.encode64(nonce);
			}

			wkr.ajax(data, function(resp) {
				if(resp.result == "error") {
					// TODO: add an duplicate_name error condition
					if(resp.error == "duplicate_signature") {
						getSalt(function(salt) { tryCreate(salt, nonce); });
					} else {
						alert("Unknown error : " + result.error);
					}
				} else {
					currentRing.subrings.push(new Ring({name:name,signature:Ring.Utils.sha256(key),subrings:[],items:[]}, currentRing));
					currentRing.ring.items.push(associatedItem);
					$(".ring").remove();
					wkr.fillRings(wkr.rootRing, 0);
				}
			});
		};

		if(name && password) {
			getSalt(tryCreate);
		}

	});

	$("#rename-subring").click(function(){
		var name = prompt('Enter new name');
		wkr.ajax({"action": "rename", "name": name, "signature": currentRing.ring.signature}, function(resp) {
			if(resp.result == "error") {
				// TODO: add an duplicate_name error condition
				alert("Unknown error : " + result.error);
			} else {
				currentRing.name = name;
				currentRing.ring.name = name;
				$(".ring").remove();
				wkr.fillRings(wkr.rootRing, 0);
				$("#current-ring").text(currentRing.name);
			}
		});
	});

	$("#remove-subring").click(function() {
		if(confirm("Do you really want to delete " + currentRing.fullname + " including its entries and its subrings ?")) {
			var data = [{action:"remove-subring",signature:currentRing.ring.signature}];
			var associatedItemIndex = null;

			for(var i in currentRing.parentRing.ring.items) {
				var item = currentRing.parentRing.ring.items[i];
				var dItem = currentRing.parentRing.decodeItem(item);
				if(dItem.type == "subring" && Ring.Utils.sha256(forge.util.decode64(dItem.key)) == currentRing.ring.signature) {
					data.push({action: "remove-item", signature: currentRing.parentRing.ring.signature, data: item});
					associatedItemIndex = i;
					break;
				}
			}

			wkr.ajax(data, function(resp) {
				if(resp.result == "error") {
					alert("Unknown error : " + resp.error);
					return;
				}

				delete currentRing.parentRing.ring.items[associatedItemIndex];
				for(var i in currentRing.parentRing.ring.subrings) {
					if(currentRing.parentRing.ring.subrings[i].signature == currentRing.ring.signature) {
						delete currentRing.parentRing.ring.subrings[i];
						delete currentRing.parentRing.subrings[i];
						break;
					}
				}

				wkr.selectRing(currentRing.parentRing);
				$(".ring").remove();
				wkr.fillRings(wkr.rootRing, 0);
			});
		}
	});

	var getSalt = function(cb) {
		forge.random.getBytes(16, function(err, salt) {
			if(err) {
				alert("Can't generate random bytes for key derivation : " + err);
				return;
			}
			cb(salt);
		});
	}

	var clear = function() {
		$("textarea").parent().removeClass("has-error");
		$("#toggle-raw").removeAttr('disabled');
		$("#save").removeAttr('disabled');
		$("#form-error").text("");

		$("#username").val("");
		$("#password").val("");
		$("#host").val("");
		$("#path").val("");
		$("#extra").val("");
		$("#secure").removeAttr("checked");
		$("#autosubmit").removeAttr("checked");
		$("#raw-data").val("");
	}

	wkr.selectRing = function(ring) {
		currentRing = ring;

		$("#current-ring").text(ring.name);
		$("tbody").text("");

		if(ring.parentRing) {
			$("#remove-subring").show();
		} else {
			$("#remove-subring").hide();
		}

		var populate = function(ring, isRec) {
			if(!ring.key) {
				if(!ring.openFromParent()) {
					alert("Can't open ring");
				}
			}

			var cls = (isRec ? ' class="recursive"' : '');
			ring.ring.items.forEach(function(item){
				var dItem = ring.decodeItem(item);
				if(dItem.type == "subring") {
					return;
				} else if(dItem.host && dItem.username) {
					var tr = $('<tr'+cls+'><td></td><td></td><td><button class="glyphicon glyphicon-trash btn"></button></td></tr>');
					$("tbody").append(tr);
					$("td:eq(0)", tr).append(dItem.host);
					$("td:eq(1)", tr).append(dItem.username);
					$("td:not(:last)", tr).click(function(){
						clear();
						wkr.setItem(dItem);
						$("#panel").show();
						$("#item-form").unbind("submit");
						$("#item-form").submit(function(){
							var data = {action: "remove-item", signature: ring.ring.signature, data: item};
							wkr.submitItem(ring, data, function() {
								delete ring.ring.items[ring.ring.items.indexOf(item)];
								wkr.selectRing(currentRing);
							});
						});
					});
					$("td:last", tr).click(function() {
						tr.addClass("danger");
						if(confirm("Do you really want to delete this item ?")) {
							wkr.ajax({action: "remove-item", signature: ring.ring.signature, data: item}, function(resp) {
								if(resp.result == "error") {
									alert("Unknown error : " + resp.error);
								} else {
									tr.remove();
									delete ring.ring.items[ring.ring.items.indexOf(item)];
								}
							});
						}
						tr.removeClass("danger");
					});
					if(!$("#toggle-recursive").hasClass("btn-default")) {
						tr.show();
					}
				}
			});

			ring.subrings.forEach(function(sr) {
				populate(sr, true);
			});
		};

		populate(ring, false);
	};

	wkr.afterLogin = function() {
		$("#new-user-div").hide();
		$("body > .container:not(#panel)").show();
	};

	wkr.load();
});
