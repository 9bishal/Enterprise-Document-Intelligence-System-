import { useEffect, useState } from 'react';
import { API_BASE } from './constants';

const FALLBACK_DEPARTMENTS = ['All Departments', 'HR', 'Legal', 'Finance', 'Technical', 'General'];
const FALLBACK_DEPARTMENT_LIST = ['HR', 'Legal', 'Finance', 'Technical', 'General'];

export function useDepartments(includeAll = true) {
  const [departments, setDepartments] = useState(includeAll ? FALLBACK_DEPARTMENTS : FALLBACK_DEPARTMENT_LIST);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch(`${API_BASE}/departments`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!active || !data || !Array.isArray(data.departments)) return;
        const list = data.departments;
        if (includeAll) {
          setDepartments(['All Departments', ...list]);
        } else {
          setDepartments(list);
        }
      })
      .catch(() => {});
    return () => { active = false; controller.abort(); };
  }, [includeAll]);

  return departments;
}