import { useState, useEffect } from "react";
import PreferenceNav from "./PreferenceNav/PreferenceNav";
import Split from "react-split";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
import EditorFooter from "./EditorFooter";
import { Problem } from "@/utils/types/problem";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import useLocalStorage from "@/hooks/useLocalStorage";
import { runJudge0Code } from "@/utils/Runner/judge0Runner";


type PlaygroundProps = {
	problem: Problem;
	setSuccess: React.Dispatch<React.SetStateAction<boolean>>;
	setSolved: React.Dispatch<React.SetStateAction<boolean>>;
};

export interface ISettings {
	fontSize: string;
	settingsModalIsOpen: boolean;
	dropdownIsOpen: boolean;
}

const Playground: React.FC<PlaygroundProps> = ({ problem, setSuccess, setSolved }) => {
	const [activeTestCaseId, setActiveTestCaseId] = useState<number>(0);
	let [userCode, setUserCode] = useState<string>(problem.starterCode);
	const [consoleOutput, setConsoleOutput] = useState("");

	const [fontSize, setFontSize] = useLocalStorage("lcc-fontSize", "16px");

	const [settings, setSettings] = useState<ISettings>({
		fontSize: fontSize,
		settingsModalIsOpen: false,
		dropdownIsOpen: false,
	});

	const [user] = useAuthState(auth);
	const { query: { pid },} = useRouter();

	const handleSubmit = async () => {
	if (!user) {
		toast.error("Please login to submit your code", {
			position: "top-center",
			autoClose: 3000,
			theme: "dark",
		});
		return;
	}

	try {
		const testCases = problem.examples.map((example) => {
			const input = extractStdin(example.inputText);
			return {
				input,
				output: example.outputText.trim(),
			};
		});

		const results = await runJudge0Code(userCode, 63, testCases);

		let allPassed = true;
		let outputMsg = "";

		results.forEach((res, i) => {
			const expected = testCases[i].output;
			const actual = res.decoded.stdout.trim();
			const status = res.status.description;

			outputMsg += `\nTest Case ${i + 1}:\nExpected: ${expected}\nReceived: ${actual}\nStatus: ${status}\n---\n`;

			if (expected !== actual || status !== "Accepted") {
				allPassed = false;
			}
		});

		setConsoleOutput(outputMsg);

		if (allPassed) {
			toast.success("✅ All test cases passed!", { position: "top-center", autoClose: 3000 , theme: "dark",});
			const userRef = doc(firestore, "users", user.uid);
			await updateDoc(userRef, { solvedProblems: arrayUnion(pid) });
			setSolved(true);
			setSuccess(true);
		} else {
			toast.error("❌ Some test cases failed", { position: "top-center", autoClose: 3000 });
			setSuccess(false);
		}
	} catch (err: any) {
		console.error(err);
		toast.error("Submission error: " + err.message, {
			position: "top-center",
			autoClose: 3000,
			theme: "dark",
		});
	}
};


	useEffect(() => {
		const code = localStorage.getItem(`code-${pid}`);
		if (user) {
			setUserCode(code ? JSON.parse(code) : problem.starterCode);
		} else {
			setUserCode(problem.starterCode);
		}
	}, [pid, user, problem.starterCode]);

	const onChange = (value: string) => {
		setUserCode(value);
		localStorage.setItem(`code-${pid}`, JSON.stringify(value));
	};

	return (
		<div className='flex flex-col bg-dark-layer-1 relative overflow-x-hidden'>
			<PreferenceNav settings={settings} setSettings={setSettings} />

			<Split className='h-[calc(100vh-94px)]' direction='vertical' sizes={[60, 40]} minSize={60}>
				<div className='w-full overflow-auto'>
					<CodeMirror
						value={userCode}
						theme={vscodeDark}
						onChange={onChange}
						extensions={[javascript()]}
						style={{ fontSize: settings.fontSize }}
					/>
				</div>
				<div className='w-full px-5 overflow-auto'>
					{/* testcase heading */}
					<div className='flex h-10 items-center space-x-6'>
						<div className='relative flex h-full flex-col justify-center cursor-pointer'>
							<div className='text-sm font-medium leading-5 text-white'>Testcases</div>
							<hr className='absolute bottom-0 h-0.5 w-full rounded-full border-none bg-white' />
						</div>
					</div>

					<div className='flex'>
						{problem.examples.map((example, index) => (
							<div
								className='mr-2 items-start mt-2 '
								key={example.id}
								onClick={() => setActiveTestCaseId(index)}
							>
								<div className='flex flex-wrap items-center gap-y-4'>
									<div
										className={`font-medium items-center transition-all focus:outline-none inline-flex bg-dark-fill-3 hover:bg-dark-fill-2 relative rounded-lg px-4 py-1 cursor-pointer whitespace-nowrap
										${activeTestCaseId === index ? "text-white" : "text-gray-500"}
									`}
									>
										Case {index + 1}
									</div>
								</div>
							</div>
						))}
					</div>

					<div className='font-semibold my-4'>
						<p className='text-sm font-medium mt-4 text-white'>Input:</p>
						<div className='w-full cursor-text rounded-lg border px-3 py-[10px] bg-dark-fill-3 border-transparent text-white mt-2'>
							{problem.examples[activeTestCaseId].inputText}
						</div>
						<p className='text-sm font-medium mt-4 text-white'>Output:</p>
						<div className='w-full cursor-text rounded-lg border px-3 py-[10px] bg-dark-fill-3 border-transparent text-white mt-2'>
							{problem.examples[activeTestCaseId].outputText}
						</div>
					</div>
				</div>
			</Split>
			<EditorFooter handleSubmit={handleSubmit} consoleOutput={consoleOutput} />		</div>
	);
};
export default Playground;

function decodeBase64Utf8(base64: string | null): string {
    if (!base64) return "";
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
}

function extractStdin(inputText: string): string {
	const numsMatch = inputText.match(/nums\s*=\s*(\[[^\]]+\])/);
	const targetMatch = inputText.match(/target\s*=\s*([0-9]+)/);

	const nums = numsMatch ? numsMatch[1] : "[]";
	const target = targetMatch ? targetMatch[1] : "0";

	return `${nums}\n${target}`;
}
