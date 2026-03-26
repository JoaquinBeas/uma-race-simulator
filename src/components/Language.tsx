import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';

import './Language.css';

const CC_GLOBAL = false; // Mocking CC_GLOBAL
const LANG_KEY = CC_GLOBAL ? 'globalLanguage' : 'language';
const defaultLanguage = localStorage.getItem(LANG_KEY) || (CC_GLOBAL ? 'en-global' : navigator.language.startsWith('ja') ? 'ja' : 'en-ja');

export function useLanguageSelect() {
    const p = useState(defaultLanguage);
    useEffect(() => localStorage.setItem(LANG_KEY, p[0]), [p[0]]);
    return p;
}

export const Language = createContext(defaultLanguage);

export function useLanguage() {
    return useContext(Language);
}

export function LanguageSelect(props: { language: string, setLanguage: (lang: string) => void }) {
	const change = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => props.setLanguage(e.target.value), [props.setLanguage])

	return (
		<select className="langSelect" value={props.language} onChange={change}>
			<option value="en">English</option>
			<option value="ja">日本語</option>
			<option value="en-ja">English with Japanese skill names</option>
		</select>
	);
}
