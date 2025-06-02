// ----------------------------------------------
// src/components/Playground.tsx
// ----------------------------------------------
import { useState, useEffect } from "react";
import PreferenceNav from "./PreferenceNav/PreferenceNav";
import Split from "react-split";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { python } from "@codemirror/lang-python"; // Cambiado a Python
import EditorFooter from "./EditorFooter";
import { Problem } from "@/utils/types/problem";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import useLocalStorage from "@/hooks/useLocalStorage";
import { runJudge0Code } from "@/utils/Runner/judge0Runner";
import { CheckCircle, XCircle } from "lucide-react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { calculatePoints } from "@/utils/calculatePoints";

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

const Playground: React.FC<PlaygroundProps> = ({
  problem,
  setSuccess,
  setSolved,
}) => {
  const router = useRouter();
  const [activeTestCaseId, setActiveTestCaseId] = useState<number>(0);
  let [userCode, setUserCode] = useState<string>(problem.starterCode);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [fontSize, setFontSize] = useLocalStorage("lcc-fontSize", "16px");
  const [settings, setSettings] = useState<ISettings>({
    fontSize: fontSize,
    settingsModalIsOpen: false,
    dropdownIsOpen: false,
  });
  const [entryTime, setEntryTime] = useState<number>(Date.now());
  const [user] = useAuthState(auth);
  const {
    query: { pid },
  } = useRouter();

  // ─── Normalización de testCases ─────────────────────────────────────────────
  const rawTestCases = problem.testCases;
  const testCases: Array<{ input: string; output: string }> = Array.isArray(
    rawTestCases
  )
    ? rawTestCases
    : Object.values(rawTestCases || {});

  const [testCaseResults, setTestCaseResults] = useState<
    Array<"success" | "error" | null>
  >(new Array(testCases.length).fill(null));

 function generateVarDeclarations(inputText: string): string {
  const regex = /([a-zA-Z_]\w*)\s*=\s*(\[[^\]]*\]|\d+)/g;
  let match;
  const lines: string[] = [];

  while ((match = regex.exec(inputText)) !== null) {
    const varName = match[1]; // ej. "nums" o "target"
    const varValue = match[2]; // ej. "[2,7,11,15]" o "9"
    lines.push(`${varName} = ${varValue}`);
  }

  return lines.join("\n");
}

  // ─── handleSubmit actualizado para Python ───────────────────────────────────
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
      const newStatus: Array<"success" | "error"> = [];
      let allPassed = true;
      let outputMsg = "";

      // Iteramos sobre cada testCase, construimos el código Python completo y lo enviamos
      for (let i = 0; i < testCases.length; i++) {
        const ex = testCases[i];

        // 1) Generamos las asignaciones en Python a partir de ex.input
        //    Ejemplo: "nums = [2,7,11,15], target = 9"
        //    -> "nums = [2,7,11,15]\ntarget = 9"
        const varDecl = generateVarDeclarations(ex.input.trim());

        // 2) Concatenamos varDecl + código del usuario (en Python)
        //    Por ejemplo, si el usuario escribió:
        //      def twoSum(nums, target):
        //          ...
        //      print(twoSum(nums, target))
        //    combinedCode contendrá:
        //      nums = [2,7,11,15]
        //      target = 9
        //
        //      def twoSum(nums, target):
        //          ...
        //      print(twoSum(nums, target))
        const combinedCode = `${varDecl}\n\n${userCode}`;

        // 3) Llamamos a Judge0 pasándole este código. No usamos stdin en Python,
        //    porque ya tenemos las variables definidas al inicio. Cambiamos el ID de
        //    lenguaje a 71 (Python 3.x). En payload solo dejamos el expected para comparar.
        const singlePayload = [
          {
            input: "", // no enviamos nada por stdin
            output: ex.output.trim(),
          },
        ];
        // El segundo parámetro (71) es el ID de Python en Judge0
        const results = await runJudge0Code(combinedCode, 92, singlePayload);
        // results es un array de tamaño 1 (solo un test por llamada)
        const res = results[0];

        const expected = ex.output.trim();
        const actual = res.decoded.stdout.trim();
        const passed =
          expected === actual && res.status.description === "Accepted";

        newStatus.push(passed ? "success" : "error");
        if (!passed) allPassed = false;

        outputMsg += `
Test Case ${i + 1}:
Expected: ${expected}
Received: ${actual}
Status: ${res.status.description}
---
`;
      }

      // Actualizamos estado de resultados y consola
      setTestCaseResults(newStatus);
      setConsoleOutput(outputMsg);

      // ── Si TODOS los tests pasaron, guardamos estadísticas en Firestore ─────────
      const statId = `${user.uid}_${pid}`;
      const statRef = doc(firestore, "user_problem_stats", statId);

      if (allPassed) {
        const submissionTime = Date.now();
        const durationInSeconds = Math.floor(
          (submissionTime - entryTime) / 1000
        );

        const statSnap = await getDoc(statRef);
        let oldExecutionCount = 0;
        if (statSnap.exists() && statSnap.data()?.executionCount != null) {
          oldExecutionCount = statSnap.data()!.executionCount as number;
        }
        const attempts = oldExecutionCount + 1;

        const pointsEarned = calculatePoints(attempts, durationInSeconds);
        await updateDoc(statRef, {
          executionCount: increment(1),
          totalExecutionTime: increment(durationInSeconds),
          lastExecutionTime: durationInSeconds,
          lastSubmittedAt: submissionTime,
          success: true,
          points: pointsEarned,
        });

        toast.success("✅ All test cases passed!", {
          position: "top-center",
          autoClose: 3000,
          theme: "dark",
        });
        const userRef = doc(firestore, "users", user.uid);
        await updateDoc(userRef, { solvedProblems: arrayUnion(pid) });
        setSolved(true);
        setSuccess(true);
        setTimeout(() => {
          router.push("/");
        }, 3200);
      } else {
        // ── Si algún test falló, actualizamos estadísticas parciales ───────────────
        toast.error("❌ Some test cases failed", {
          position: "top-center",
          autoClose: 3000,
          theme: "dark",
        });
        setSuccess(false);
        await updateDoc(statRef, {
          executionCount: increment(1),
          success: false,
          lastSubmittedAt: Date.now(),
        });
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

  // ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const code = localStorage.getItem(`code-${pid}`);
    if (user) {
      setUserCode(code ? JSON.parse(code) : problem.starterCode);
    } else {
      setUserCode(problem.starterCode);
    }
  }, [pid, user, problem.starterCode]);

  if (user && pid) {
    const statId = `${user.uid}_${pid}`;
    const statRef = doc(firestore, "user_problem_stats", statId);

    getDoc(statRef).then((docSnap) => {
      if (!docSnap.exists()) {
        setDoc(statRef, {
          userId: user.uid,
          problemId: pid,
          executionCount: 0,
          totalExecutionTime: 0,
          lastExecutionTime: 0,
          lastSubmittedAt: null,
          success: false,
          points: 0,
        });
      }
    });
  }

  return (
    <div className="flex flex-col bg-dark-layer-1 relative overflow-x-hidden">
      <PreferenceNav settings={settings} setSettings={setSettings} />

      <Split
        className="h-[calc(100vh-94px)]"
        direction="vertical"
        sizes={[60, 40]}
        minSize={60}
      >
        {/* ─────────── Editor ─────────── */}
        <div className="w-full overflow-auto">
          <CodeMirror
            value={userCode}
            theme={vscodeDark}
            extensions={[python()]} // Cambiado a Python
            onChange={(value) => {
              setUserCode(value);
              localStorage.setItem(`code-${pid}`, JSON.stringify(value));
            }}
            style={{ fontSize: settings.fontSize }}
          />
        </div>

        {/* ─────────── Consola + Testcases ─────────── */}
        <div className="w-full px-5 overflow-auto">
          <div className="flex h-10 items-center space-x-6">
            <div className="relative flex h-full flex-col justify-center cursor-pointer">
              <div className="text-sm font-medium leading-5 text-white">
                Testcases
              </div>
              <hr className="absolute bottom-0 h-0.5 w-full rounded-full border-none bg-white" />
            </div>
          </div>

          {/* tabs: iteramos sobre testCases normalizados */}
          <div className="flex">
            {testCases.map((ex, idx) => (
              <div
                key={`case-${idx}`}
                className="mr-2 items-start mt-2"
                onClick={() => setActiveTestCaseId(idx)}
              >
                <div className="flex flex-wrap items-center gap-y-4">
                  <div
                    className={`font-medium inline-flex items-center gap-1 rounded-lg px-4 py-1 cursor-pointer whitespace-nowrap transition-all
                      ${
                        activeTestCaseId === idx ? "text-white" : "text-gray-400"
                      }
                      ${
                        testCaseResults[idx] === "success"
                          ? "bg-green-600 text-white"
                          : testCaseResults[idx] === "error"
                          ? "bg-red-600 text-white"
                          : "bg-dark-fill-3 hover:bg-dark-fill-2"
                      }`}
                  >
                    Case {idx + 1}
                    {testCaseResults[idx] === "success" && (
                      <CheckCircle size={16} strokeWidth={2} />
                    )}
                    {testCaseResults[idx] === "error" && (
                      <XCircle size={16} strokeWidth={2} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* muestra input / output del case activo */}
          <div className="font-semibold my-4">
            <p className="text-sm font-medium mt-4 text-white">Input:</p>
            <div className="w-full cursor-text rounded-lg border px-3 py-[10px] bg-dark-fill-3 border-transparent text-white mt-2">
              {testCases[activeTestCaseId]?.input ?? ""}
            </div>

            <p className="text-sm font-medium mt-4 text-white">Output:</p>
            <div className="w-full cursor-text rounded-lg border px-3 py-[10px] bg-dark-fill-3 border-transparent text-white mt-2">
              {testCases[activeTestCaseId]?.output ?? ""}
            </div>
          </div>
        </div>
      </Split>

      <EditorFooter handleSubmit={handleSubmit} consoleOutput={consoleOutput} />
    </div>
  );
};

export default Playground;
