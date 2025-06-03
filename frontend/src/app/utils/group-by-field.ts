

export function groupByField<T extends Record<string, any>>(objects: T[], field: keyof T): Record<T[keyof T], T[]> {
    return objects.reduce((record, obj) => {
        const key = obj[field];
        record[key] = record[key] || [];
        record[key].push(obj);
        return record;
    }, {} as Record<T[keyof T], T[]>);
}
