export function partition(arr, pred) {
  const trueArr = [];
  const falseArr = [];
  
  for (let i = 0; i < arr.length; i++) {
    if (pred(arr[i])) {
      trueArr.push(arr[i]);
    } else {
      falseArr.push(arr[i]);
    }
  }
  
  return [trueArr, falseArr];
}