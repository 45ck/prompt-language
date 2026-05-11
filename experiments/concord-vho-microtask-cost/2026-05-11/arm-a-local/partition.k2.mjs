export function partition(arr, pred) {
    const truthy = [];
    const falsy = [];
    for (const item of arr) {
        if (pred(item)) {
            truthy.push(item);
        } else {
            falsy.push(item);
        }
    }
    return [truthy, falsy];
}