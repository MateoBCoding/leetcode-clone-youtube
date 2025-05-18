export async function runJudge0Code(
	sourceCode: string,
	languageId: number,
	testCases: Array<{ input: string; output: string }>
) {
	const results = [];

	for (const testCase of testCases) {
		const submission = {
			language_id: languageId,
			source_code: btoa(sourceCode),
			stdin: btoa(testCase.input),
			expected_output: btoa(testCase.output),
		};

		const response = await fetch(
			"https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=false",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-rapidapi-host": "judge0-ce.p.rapidapi.com",
					"x-rapidapi-key": "ad097b7ce1msh7a28d1beb5dd162p179b1ejsna1f48b197c4c",
				},
				body: JSON.stringify(submission),
			}
		);

		const { token } = await response.json();

		let result;
		let statusId = 1;

		while (statusId <= 2) {
			const resultResponse = await fetch(
				`https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=true`,
				{
					method: "GET",
					headers: {
						"x-rapidapi-host": "judge0-ce.p.rapidapi.com",
						"x-rapidapi-key": "ad097b7ce1msh7a28d1beb5dd162p179b1ejsna1f48b197c4c",
					},
				}
			);
			result = await resultResponse.json();
			statusId = result.status.id;
			if (statusId <= 2) {
				await new Promise((resolve) => setTimeout(resolve, 1500));
			}
		}

		const decoded = {
			stdout: decodeBase64Utf8(result.stdout),
			stderr: decodeBase64Utf8(result.stderr),
			compile_output: decodeBase64Utf8(result.compile_output),
			message: decodeBase64Utf8(result.message),
		};

		results.push({
			...result,
			decoded,
			passed: result.status.id === 3 && decoded.stderr === "" && decoded.compile_output === "",
		});
	}

	return results;
}

function decodeBase64Utf8(base64: string | null): string {
	if (!base64) return "";
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return new TextDecoder("utf-8").decode(bytes);
}
