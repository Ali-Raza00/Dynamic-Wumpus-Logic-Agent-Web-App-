// logic.js
class KnowledgeBase {
    constructor() {
        this.clauses = []; // Array of Set<string>
    }

    addClause(literalsArray) {
        this.clauses.push(new Set(literalsArray));
    }

    // Helper to negate a literal
    static negate(literal) {
        return literal.startsWith('!') ? literal.substring(1) : '!' + literal;
    }

    // Resolve two clauses, returning array of resolvents (Sets)
    static resolve(c1, c2) {
        let resolvents = [];
        for (let l1 of c1) {
            let neg_l1 = this.negate(l1);
            if (c2.has(neg_l1)) {
                let r = new Set([...c1, ...c2]);
                r.delete(l1);
                r.delete(neg_l1);
                
                // check tautology
                let isTaut = false;
                for (let l of r) {
                    if (r.has(this.negate(l))) {
                        isTaut = true;
                        break;
                    }
                }
                if (!isTaut) {
                    resolvents.push(r);
                }
            }
        }
        return resolvents;
    }

    static clauseStr(c) {
        return Array.from(c).sort().join('|');
    }

    // Prove queryClause using Set of Support Refutation
    // queryClause is the NEGATION of what we want to prove.
    // e.g., to prove !P_2_2, queryClause is {P_2_2}
    prove(queryClause) {
        let steps = 0;
        let background = this.clauses.map(c => new Set(c));
        let sos = [new Set(queryClause)];
        
        let seen = new Set();
        for (let c of background) seen.add(KnowledgeBase.clauseStr(c));
        seen.add(KnowledgeBase.clauseStr(queryClause));
        
        let MAX_STEPS = 5000;
        
        while (sos.length > 0) {
            // Unit preference: pick the shortest clause
            let bestIdx = 0;
            for (let i = 1; i < sos.length; i++) {
                if (sos[i].size < sos[bestIdx].size) bestIdx = i;
            }
            let current = sos.splice(bestIdx, 1)[0];
            
            // Resolve current with all background clauses
            for (let bg of background) {
                steps++;
                if (steps > MAX_STEPS) return { proven: false, steps, timeout: true };
                
                let resolvents = KnowledgeBase.resolve(current, bg);
                for (let r of resolvents) {
                    if (r.size === 0) return { proven: true, steps }; // Contradiction found
                    let str = KnowledgeBase.clauseStr(r);
                    if (!seen.has(str)) {
                        seen.add(str);
                        sos.push(r);
                    }
                }
            }
            // Add current to background so it can be resolved with future SOS clauses
            background.push(current);
        }
        return { proven: false, steps };
    }
}
