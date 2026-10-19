/** Additive vocabulary for the existing fictional family; never rewrites relative kinship or custom mappings. */
export function installDemoNames(s) { const f = s.families['lin-family']; if (f && f.assistantNames === undefined)
    f.assistantNames = [{ personId: 'lin-elder', aliases: ['外婆', '外祖母', '姥姥'] }, { personId: 'mother', aliases: ['媽媽', '母親'] }, { personId: 'father', aliases: ['爸爸', '父親'] }, { personId: 'lin-child', aliases: ['小宇', '弟弟'] }, { personId: 'student', aliases: ['晴晴'] }]; return s; }
