export async function runJudge0Code(sourceCode: string, languageId: number, testCases: Array<{ input: string; output: string }>) {
    const results = [];

    for (const testCase of testCases) {
        const submission = {
            language_id: languageId,
            source_code: btoa(sourceCode), // Base64 encode
            stdin: btoa(testCase.input),
            expected_output: btoa(testCase.output),
        };

        const response = await fetch("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true&fields=*",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
                    "x-rapidapi-key": "ad097b7ce1msh7a28d1beb5dd162p179b1ejsna1f48b197c4c"
                },
                body: JSON.stringify(submission),
            });

        if (!response.ok) {
            throw new Error(`Error from Judge0: ${response.statusText}`);
        }

        const result = await response.json();
        results.push(result);
    }

    return results;
}
