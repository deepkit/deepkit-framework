class Service {}

const resolved = [0];


for (let i = 0; i < 10000; i++) {
	if (!resolved[0]) resolved[0] = new Service();
	let v = resolved[0];
}

console.log(%HasFastProperties(resolved));



