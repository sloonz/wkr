<?php
define('KR_PATH', '/var/lib/wkr');

class Ring {
	public $name;
	public $signature;
	public $salt;
	public $items;
	public $subrings;

	private $parent;

	public function __construct($json_data, $parent) {
		if($json_data) {
			$this->name = $json_data->name;
			$this->signature = $json_data->signature;
			$this->salt = $json_data->salt;
			$this->items = $json_data->items;
			$this->subrings = array();

			foreach($json_data->subrings as $sr) {
				$this->subrings[] = new Ring($sr, $this);
			}
		}

		$this->parent = $parent;
	}

	public function getParent() {
		return $this->parent;
	}

	public function findRingBySignature($signature) {
		if($this->signature == $signature)
			return $this;

		foreach($this->subrings as $sr) {
			if(($r = $sr->findRingBySignature($signature)))
				return $r;
		}

		return null;
	}

	public function findRingByItem($item) {
		foreach($this->items as $it) {
			if($item == $it)
				return $this;
		}

		foreach($this->subrings as $sr) {
			if(($r = $sr->findRingByItem($item)))
				return $r;
		}

		return null;
	}

	public function addItem($data) {
		$this->items[] = $data;
	}

	public function removeItem($item) {
		$new_items = array();
		foreach($this->items as $it) {
			if($item != $it)
				$new_items[] = $it;
		}
		$this->items = $new_items;
	}

	public function addSubring($sr) {
		$this->subrings[] = $sr;
	}

	public function removeSubring($signature) {
		$new_subrings = array();
		foreach($this->subrings as $sr) {
			if($sr->signature != $signature)
				$new_subrings[] = $sr;
		}
		$this->subrings = $new_subrings;
	}
}

$username = (string)$_GET['username'];
$basename = KR_PATH . "/" . $username;

if(!preg_match('/^[a-zA-Z0-9]+$/', $username)) {
	die(json_encode(array(
		"result" => "error",
		"error" => "bad_username"
	)));
}

$actions = json_decode(file_get_contents("php://input"));

$dirty = false;
$loaded = false;

foreach($actions as $action) {
	try {
		if($action->action != "get")
			$dirty = true;

		if($action->action == "create") {
			if(file_exists("{$basename}.json"))
				die(json_encode(array(
					"result" => "error",
					"error" => "existing"
				)));

			$root = new Ring(null, null);
			$root->name = $action->name;
			$root->salt = $action->salt;
			$root->signature = $action->signature;
			$root->items = (isset($action->items) ? $action->items : array());
			$root->subrings = (isset($action->subrings) ? $action->subrings : array());
			$loaded = true;
			continue;
		}

		if(!$loaded) {
			if(!file_exists("{$basename}.json"))
				throw new Exception("not_found");
			$json_data = json_decode(file_get_contents("{$basename}.json"));
			if(!$json_data)
				throw new Exception("not_found");
			$root = new Ring($json_data, null);
			$loaded = true;
		}

		switch($action->action) {
		case "get":
			die(json_encode(array("result" => "ok", "ring" => $root)));
		case "add-item":
			if(!($ring = $root->findRingBySignature($action->signature)))
				throw new Exception("not_found");
			if(in_array($action->data, $ring->items))
				throw new Exception("duplicate_item");
			$ring->addItem($action->data);
			break;
		case "remove-item":
			if(!($ring = $root->findRingBySignature($action->signature)))
				throw new Exception("not_found");
			if(!in_array($action->data, $ring->items))
				throw new Exception("item_not_found");
			$ring->removeItem($action->data);
			break;
		case "add-subring":
			if(!($parent_ring = $root->findRingBySignature($action->parent_signature)))
				throw new Exception("not_found");
			if($root->findRingBySignature($action->signature))
				throw new Exception("duplicate_signature");

			$ring = new Ring(null, $parent_ring);
			$ring->name = $action->name;
			$ring->salt = $action->salt;
			$ring->signature = $action->signature;
			$ring->items = (isset($action->items) ? $action->items : array());
			$ring->subrings = (isset($action->subrings) ? $action->subrings : array());

			$parent_ring->addSubring($ring);

			break;
		case "remove-subring":
			if(!($ring = $root->findRingBySignature($action->signature)))
				throw new Exception("not_found");
			if(!($parent_ring = $ring->getParent()))
				throw new Exception("cant_remove_root");

			$parent_ring->removeSubring($action->signature);
			break;
		case "rename":
			if(!($ring = $root->findRingBySignature($action->signature)))
				throw new Exception("not_found");
			$ring->name = $action->name;
			break;
		case "change-signature":
			$root->signature = $action->signature;
			break;
		}
	} catch(Exception $e) {
		die(json_encode(array(
			"result" => "error",
			"error" => $e->getMessage(),
			"action" => $action
		)));
	}
}

if($dirty) {
	file_put_contents("{$basename}.json-new", json_encode($root));
	if(file_exists("{$basename}.json"))
		rename("{$basename}.json", "{$basename}.json-".time());
	rename("{$basename}.json-new", "{$basename}.json");
}

die(json_encode(array("result" => "ok")));
