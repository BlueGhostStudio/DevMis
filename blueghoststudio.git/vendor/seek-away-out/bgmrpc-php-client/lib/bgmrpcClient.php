<?php
function __rpcCall ($client, $r) {
	$client->send ($r);
	while (1) {
		$receiveData = json_decode ($client->receive ());
		if ($receiveData->type == 'return')
			return $receiveData->values;
	}
}

function toRequest ($args, $argn, $isJs=false) {
	if ($argn < 3)
		return false;

	$cr = array ();
	$cra = array ();
	$cr['object'] = $args[1];
	if ($isJs) {
		$cr['method'] = 'js';
		$cra[] = $args[2];
	} else
		$cr['method'] = $args[2];

	for ($i = 3; $i < $argn; $i++)
		$cra[] = $args[$i];
	if (count ($cra) > 0)
		$cr['args'] = $cra;

	return json_encode ($cr);
}

function rpcCall () {
	$args = func_get_args ();
	$req = toRequest ($args, func_num_args ());
	if (req == false)
		return null;
	else
		return __rpcCall ($args[0], $req);
}

function rpcJCall () {
	$args = func_get_args ();
	$req = toRequest ($args, func_num_args (), true);
	if (req == false)
		return null;
	else
		return __rpcCall ($args[0], $req);
}
?>
