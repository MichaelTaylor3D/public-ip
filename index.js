import fetch from "node-fetch";

const defaults = {
	timeout: 5000,
	onlyHttps: false,
};

const dnsServers = [
	{
		v4: {
			servers: [
				"208.67.222.222",
				"208.67.220.220",
				"208.67.222.220",
				"208.67.220.222",
			],
			name: "myip.opendns.com",
			type: "A",
		},
		v6: {
			servers: ["2620:0:ccc::2", "2620:0:ccd::2"],
			name: "myip.opendns.com",
			type: "AAAA",
		},
	},
	{
		v4: {
			servers: [
				"216.239.32.10",
				"216.239.34.10",
				"216.239.36.10",
				"216.239.38.10",
			],
			name: "o-o.myaddr.l.google.com",
			type: "TXT",
			transform: (ip) => ip.replace(/"/g, ""),
		},
		v6: {
			servers: [
				"2001:4860:4802:32::a",
				"2001:4860:4802:34::a",
				"2001:4860:4802:36::a",
				"2001:4860:4802:38::a",
			],
			name: "o-o.myaddr.l.google.com",
			type: "TXT",
			transform: (ip) => ip.replace(/"/g, ""),
		},
	},
];

const type = {
	v4: {
		dnsServers: dnsServers.map(({ v4: { servers, ...question } }) => ({
			servers,
			question,
		})),
		httpsUrls: ["https://icanhazip.com/", "https://api.ipify.org/"],
	},
	v6: {
		dnsServers: dnsServers.map(({ v6: { servers, ...question } }) => ({
			servers,
			question,
		})),
		httpsUrls: ["https://icanhazip.com/", "https://api6.ipify.org/"],
	},
};

const queryHttps = (version, options) => {
	let cancel;

	const promise = (async () => {
		try {
			const requestOptions = {
				dnsLookupIpVersion: version === "v6" ? 6 : 4,
				retry: {
					limit: 0,
				},
				timeout: {
					request: options.timeout,
				},
			};

			const urls = [
				...type[version].httpsUrls,
				...(options.fallbackUrls ?? []),
			];

			let lastError;
			for (const url of urls) {
				try {
					// Note: We use `.get` to allow for mocking.
					const response = await fetch(url, requestOptions);

					if (response.ok) {
						const data = await response.text();

						console.log("@@@@", data);

						const ip = (data || "").trim();

						return ip;
					}
				} catch (error) {
					lastError = error;

					if (error instanceof CancelError) {
						throw error;
					}
				}
			}

			throw new IpNotFoundError({ cause: lastError });
		} catch (error) {
			// Don't throw a cancellation error for consistency with DNS
			if (!(error instanceof CancelError)) {
				throw error;
			}
		}
	})();

	promise.cancel = function () {
		return cancel.apply(this);
	};

	return promise;
};

const queryAll = (version, options) => {
	let cancel;
	const promise = (async () => {
		let response;

		const httpsPromise = queryHttps(version, options);
		cancel = httpsPromise.cancel;
		response = await httpsPromise;

		return response;
	})();

	promise.cancel = cancel;

	return promise;
};

export function publicIpv4(options) {
	options = {
		...defaults,
		...options,
	};

	if (!options.onlyHttps) {
		return queryAll("v4", options);
	}

	if (options.onlyHttps) {
		return queryHttps("v4", options);
	}

	return queryDns("v4", options);
}
