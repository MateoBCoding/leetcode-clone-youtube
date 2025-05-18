import Link from "next/link";
import React from "react";
import { BsCheckCircle } from "react-icons/bs";
import { DBProblem } from "@/utils/types/problem";

type ProblemsTableProps = {
  problems: DBProblem[];
  solvedProblems: string[];
};

const ProblemsTable: React.FC<ProblemsTableProps> = ({
  problems,
  solvedProblems,
}) => {
  return (
    <>
      <tbody className='text-white'>
        {problems.map((problem, idx) => {
          const difficultyColor =
            problem.difficulty === "Easy" ? "text-dark-green-s": 
            problem.difficulty === "Medium"? "text-dark-yellow" : "text-dark-pink";
          return (
            <tr className={`${idx % 2 == 1 ? "bg-dark-layer-1" : ""}`} key={problem.id}>
              <th className='px-2 py-4 font-medium whitespace-nowrap text-dark-green-s'>
                {solvedProblems.includes(problem.id) && <BsCheckCircle fontSize={"18"} />}
              </th>
              <td className='px-6 py-4'>
                <Link
                  href={problem.link ? problem.link : `/problems/${problem.id}`}
                  className='hover:text-blue-600 cursor-pointer'
                  target={problem.link ? "_blank" : "_self"}
                >
                  {problem.title}
                </Link>
              </td>
              <td className={`px-6 py-4 ${difficultyColor}`}>{problem.difficulty}</td>
              <td className={"px-6 py-4"}>{problem.category}</td>
            </tr>
          );
        })}
      </tbody>
    </>
  );
};

export default ProblemsTable;
