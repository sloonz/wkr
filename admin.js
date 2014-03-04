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
		$("#create-account-dialog").modal("show");
		$("#create-account-dialog form").submit(function(){
			var ok = true;
			["login", "ring-name", "ring-password"].forEach(function(it){
				if(!$("#create-account-"+it).val()) {
					ok = false;
					$("#create-account-"+it).parent().addClass("has-error");
				} else {
					$("#create-account-"+it).parent().removeClass("has-error");
				}
			});
			if(ok) {
				getSalt(function(salt){
					var key = Ring.Utils.derivateKey($("#create-account-ring-password").val(), salt);
					wkr.keyringCred = { id: Ring.Utils.sha256($("#create-account-login").val()), key: key };
					var data = {};
					data.action = "create";
					data.name = $("#create-account-ring-name").val();
					data.salt = forge.util.encode64(salt);
					data.signature = Ring.Utils.sha256(key);
					wkr.ajax(data, function(resp) {
						if(resp.result == "error") {
							if(resp.error == "existing") {
								alert('This account already exists');
							} else {
								alert('Unknown error : ' + resp.error);
							}
						} else {
							$("#create-account-dialog").modal("hide");
							wkr.doLogin(null, $("#create-account-ring-password").val(), $("#create-account-remember :selected").val());
						}
					});
				});
			}
			return false;
		});
	});

	$("#create-subring").click(function(){
		$("#edit-ring-dialog").modal("show");
		$("#edit-ring-dialog .create").show();
		$("#edit-ring-dialog .modify").hide();
		$("#edit-ring-dialog form").submit(function() {
			var name = $("#edit-ring-name").val();
			var password = $("#edit-ring-password").val();
			var tryCreate = function(salt) {
				var key = Ring.Utils.derivateKey(password, salt);
				var associatedItem = currentRing.encodeItem({type:"subring", key:forge.util.encode64(key)});
				var data = [];
				data.push({action: "add-item", data: associatedItem, signature: currentRing.signature});
				data.push({action: "add-subring", name: name, signature: Ring.Utils.sha256(key), salt: forge.util.encode64(salt), parent_signature: currentRing.signature});

				wkr.ajax(data, function(resp) {
					if(resp.result == "error") {
						// TODO: add an duplicate_name error condition
						if(resp.error == "duplicate_signature") {
							getSalt(tryCreate);
						} else {
							alert("Unknown error : " + result.error);
						}
					} else {
						var subring = new Ring({name:name,signature:Ring.Utils.sha256(key),subrings:[],items:[]}, currentRing);
						currentRing.subrings.push(subring);
						currentRing.items.push(associatedItem);
						$(".ring").remove();
						wkr.fillRings(wkr.rootRing, 0);
						$("#edit-ring-dialog").modal("hide");
					}
				});
			};

			$("#edit-ring-dialog .has-error").removeClass("has-error");
			if(!name) {
				$("#edit-ring-name").parent().addClass("has-error");
			}
			if(!password) {
				$("#edit-ring-password").parent().addClass("has-error");
			}
			if(name && password) {
				getSalt(tryCreate);
			}

			return false;
		});
	});

	$("#remove-subring").click(function() {
		if(confirm("Do you really want to delete " + currentRing.fullname + " including its entries and its subrings ?")) {
			var data = [{action:"remove-subring",signature:currentRing.signature}];
			var associatedItemIndex = currentRing.parentRing.indexOfAssociatedItem(currentRing.signature);
			data.push({action: "remove-item", signature: currentRing.parentRing.signature, data: currentRing.parentRing.items[associatedItemIndex]});

			wkr.ajax(data, function(resp) {
				if(resp.result == "error") {
					alert("Unknown error : " + resp.error);
					return;
				}

				delete currentRing.parentRing.items[associatedItemIndex];
				for(var i in currentRing.parentRing.subrings) {
					if(currentRing.parentRing.subrings[i].signature == currentRing.signature) {
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

	$("#edit-subring").click(function(){
		$("#edit-ring-dialog").modal("show");
		$("#edit-ring-name").val(currentRing.name);
		$("#edit-ring-dialog .create").hide();
		$("#edit-ring-dialog .modify").show();
		$("#edit-ring-dialog form").submit(function() {
			var name = $("#edit-ring-name").val();
			var password = $("#edit-ring-password").val();
			var barrier = 0;
			$("#edit-ring-dialog .has-error").removeClass("has-error");
			if(!name) {
				$("#edit-ring-name").parent().addClass("has-error");
				return false;
			}
			if(name != currentRing.name) {
				barrier++;
				wkr.ajax({"action": "rename", "name": $("#edit-ring-name").val(), "signature": currentRing.signature}, function(resp) {
					if(resp.result == "error") {
						// TODO: add an duplicate_name error condition
						alert("Unknown error : " + result.error);
					} else {
						currentRing.name = name;
						$(".ring").remove();
						$("#current-ring").text(name);
						wkr.fillRings(wkr.rootRing, 0);
						if(--barrier == 0) {
							$("#edit-ring-dialog").modal("hide");
						}
					}
				});
			}
			if(password) {
				barrier++;
				var tryChangePassword = function(salt) {
					var key = Ring.Utils.derivateKey(password, salt);
					var newItems = [];
					var data = [];
					currentRing.items.forEach(function(item) {
						newItems.push(forge.util.encode64(Ring.Utils.aesEncode(JSON.stringify(currentRing.decodeItem(item)), key)));
						data.push({"action": "remove-item", "signature": currentRing.signature, "data": item});
					});
					newItems.forEach(function(item){
						data.push({"action": "add-item", "signature": currentRing.signature, "data": item});
					});
					if(currentRing.parentRing) {
						var associatedItemIndex = currentRing.parentRing.indexOfAssociatedItem(currentRing.signature);
						var newAssociatedItem = currentRing.parentRing.encodeItem({"type":"subring","key": forge.util.encode64(key)})
						data.push({"action": "remove-item", "signature": currentRing.parentRing.signature, "data": currentRing.parentRing.items[associatedItemIndex]});
						data.push({"action": "add-item", "signature": currentRing.parentRing.signature, "data": newAssociatedItem});
					}
					data.push({"action": "change-signature", "old_signature": currentRing.signature, "new_signature": Ring.Utils.sha256(key), "new_salt": forge.util.encode64(salt)});
					wkr.ajax(data, function(resp) {
						if(resp.error) {
							if(resp.error == "duplicate_signature") {
								getSalt(tryChangePassword);
							} else {
								alert("Unknown error : " + result.error);
							}
						} else {
							currentRing.key = key;
							currentRing.signature = Ring.Utils.sha256(key);
							currentRing.items = newItems;
							currentRing.salt = salt;
							if(currentRing.parentRing) {
								delete currentRing.parentRing.items[associatedItemIndex];
								currentRing.parentRing.items.push(newAssociatedItem);
							}
							wkr.selectRing(currentRing);
							if(--barrier == 0) {
								$("#edit-ring-dialog").modal("hide");
							}
						}
					});
				};
				getSalt(tryChangePassword);
			}
			if(!barrier) {
				$("#edit-ring-dialog").modal("hide");
			}
			return false;
		});
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
			ring.items.forEach(function(item){
				var dItem = ring.decodeItem(item);
				if(dItem.type != "subring") {
					var tr = $('<tr'+cls+'><td></td><td></td><td><button class="glyphicon glyphicon-pencil btn"></button><button class="glyphicon glyphicon-trash btn"></button></td></tr>');
					$("tbody").append(tr);
					$("td:eq(0)", tr).append(dItem.host || "(none)");
					$("td:eq(1)", tr).append(dItem.username || "(none)");
					$("td:not(:last)", tr).click(function(){
						clear();
						wkr.setItem(dItem);
						$("#panel").show();
						$("#item-form").unbind("submit");
						$("#item-form").submit(function(){
							var data = {action: "remove-item", signature: ring.signature, data: item};
							wkr.submitItem(ring, data, function() {
								delete ring.items[ring.items.indexOf(item)];
								wkr.selectRing(currentRing);
							});
						});
					});
					$(".glyphicon-trash", tr).click(function() {
						tr.addClass("danger");
						if(confirm("Do you really want to delete this item ?")) {
							wkr.ajax({action: "remove-item", signature: ring.signature, data: item}, function(resp) {
								if(resp.result == "error") {
									alert("Unknown error : " + resp.error);
								} else {
									tr.remove();
									delete ring.items[ring.items.indexOf(item)];
								}
							});
						}
						tr.removeClass("danger");
					});
					$(".glyphicon-pencil", tr).click(function(){
						$("#move-item-dialog").modal("show");
						$("#move-item-ring-list li").remove();
						$("#move-item-dialog .ring-name").text(currentRing.name);
						var selectedRing = currentRing;
						var fillSelector = function(ring, indent) {
							var li = $('<li><a href="#"><span style="margin-left:'+indent+'em">toto</span></a></li>');
							$("span", li).text(ring.name);
							$("a", li).attr("onclick", "return false;");
							$("#move-item-ring-list").append(li);
							$("a", li).click(function() {
								selectedRing = ring;
								$("#move-item-dialog .ring-name").text(selectedRing.name);
							});
							ring.subrings.forEach(function(sr){
								fillSelector(sr, indent+1);
							});
						};
						fillSelector(wkr.rootRing, 0);
						$("#move-item-dialog .modal-footer .btn-primary").click(function() {
							var movedItem = selectedRing.encodeItem(dItem);
							var data = [];
							data.push({action: "remove-item", signature: ring.signature, data: item});
							data.push({action: "add-item", signature: selectedRing.signature, data: movedItem});
							wkr.ajax(data, function(resp) {
								if(resp.result == "error") {
									alert("Unknown error: "+ resp.error);
								} else {
									selectedRing.items.push(movedItem);
									delete ring.items[ring.items.indexOf(item)];
									wkr.selectRing(currentRing);
									$("#move-item-dialog").modal("hide");
								}
							}); 
						});

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
