import React, { useState } from "react";
import { BsChevronUp, BsChevronDown } from "react-icons/bs";

type EditorFooterProps = {
	handleSubmit: () => void;
	consoleOutput: string;
};

const EditorFooter: React.FC<EditorFooterProps> = ({ handleSubmit, consoleOutput}) => {
	const [consoleOpen, setConsoleOpen] = useState(false);
	
	return (
		<>
			{/* Footer Bar */}
			<div className='flex bg-dark-layer-1 absolute bottom-0 z-10 w-full'>
				<div className='mx-5 my-[10px] flex justify-between w-full'>
					<div className='mr-2 flex flex-1 flex-nowrap items-center space-x-4'>
						<button
							className='px-3 py-1.5 font-medium items-center transition-all inline-flex bg-dark-fill-3 text-sm hover:bg-dark-fill-2 text-dark-label-2 rounded-lg pl-3 pr-2'
							onClick={() => setConsoleOpen(!consoleOpen)}
						>
							Console
							<div className='ml-1 transform transition flex items-center'>
								{consoleOpen ? (
									<BsChevronDown className='fill-gray-6 mx-1 fill-dark-gray-6' />
								) : (
									<BsChevronUp className='fill-gray-6 mx-1 fill-dark-gray-6' />
								)}
							</div>
						</button>
					</div>
					<div className='ml-auto flex items-center space-x-4'>
						
						<button
							className='px-3 py-1.5 font-medium items-center transition-all focus:outline-none inline-flex text-sm text-white bg-dark-green-s hover:bg-green-3 rounded-lg'
							onClick={handleSubmit}
						>
							Submit
						</button>
					</div>
				</div>
			</div>

			{/* Console Modal */}
			{consoleOpen && (
				<div className='absolute bottom-[60px] left-0 w-full bg-black text-green-400 p-4 h-40 overflow-y-auto z-20 shadow-lg rounded-t-md'>
					<p className='text-sm whitespace-pre-wrap'>{consoleOutput || "Console is empty..."}</p>
					{/* Aquí puedes agregar logs dinámicos */}
				</div>
			)}
		</>
	);
};

export default EditorFooter;
