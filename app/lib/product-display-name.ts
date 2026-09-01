const PRODUCT_HANJA:Record<string,string>={jin:"眞",seon:"善",mi:"美"};

export function productDisplayName(product:{id:string;name:string}){
 const hanja=PRODUCT_HANJA[product.id];
 return hanja?`${product.name}(${hanja})`:product.name;
}
