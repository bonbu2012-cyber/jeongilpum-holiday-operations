"use client";

import { useEffect, useState } from "react";

type EditableProduct = {
  id:string; category:string; code:string; name:string; subtitle:string; description:string;
  price:number; customerDisplayWeight:string|null; imageUrl:string|null; badge:string|null;
  displayOrder:number; active:boolean; version:number; updatedAt:string|null;
};
type EditableSeason = {
  id:string; name:string; holidayDate:string; salesStartDate:string; salesEndDate:string;
  active:boolean; version:number; updatedAt:string|null;
};

export default function SettingsApp(){
  const[products,setProducts]=useState<EditableProduct[]>([]);
  const[seasons,setSeasons]=useState<EditableSeason[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");
  const[saving,setSaving]=useState("");

  const load=async()=>{
    try{
      const response=await fetch("/api/settings",{cache:"no-store"});
      const data=await response.json() as {products?:EditableProduct[];seasons?:EditableSeason[];error?:string};
      if(!response.ok)throw new Error(data.error);
      setProducts(data.products??[]);
      setSeasons(data.seasons??[]);
      setError("");
    }catch(caught){setError(caught instanceof Error?caught.message:"설정을 불러오지 못했습니다.")}
    finally{setLoading(false)}
  };
  useEffect(()=>{const frame=requestAnimationFrame(()=>{void load()});return()=>cancelAnimationFrame(frame)},[]);

  const updateProduct=(id:string,key:keyof EditableProduct,value:string|number|boolean|null)=>{
    setProducts(current=>current.map(item=>item.id===id?{...item,[key]:value}:item));
  };
  const updateSeason=(id:string,key:keyof EditableSeason,value:string|boolean)=>{
    setSeasons(current=>current.map(item=>item.id===id?{...item,[key]:value}:item));
  };

  const saveProduct=async(item:EditableProduct)=>{
    setSaving(item.id);setNotice("");
    try{
      const response=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"product",...item,expectedVersion:item.version})});
      const data=await response.json() as {version?:number;updatedAt?:string;error?:string};
      if(!response.ok)throw new Error(data.error);
      setProducts(current=>current.map(product=>product.id===item.id?{...product,version:data.version??product.version+1,updatedAt:data.updatedAt??product.updatedAt}:product));
      setNotice(item.name+" 상품 설정을 저장했습니다.");
    }catch(caught){setNotice(caught instanceof Error?caught.message:"상품 설정을 저장하지 못했습니다.")}
    finally{setSaving("")}
  };

  const saveSeason=async(item:EditableSeason)=>{
    setSaving(item.id);setNotice("");
    try{
      const response=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"season",...item,expectedVersion:item.version})});
      const data=await response.json() as {version?:number;updatedAt?:string;error?:string};
      if(!response.ok)throw new Error(data.error);
      setSeasons(current=>current.map(season=>season.id===item.id?{...season,version:data.version??season.version+1,updatedAt:data.updatedAt??season.updatedAt}:season));
      setNotice("판매 일정을 저장했습니다.");
    }catch(caught){setNotice(caught instanceof Error?caught.message:"판매 일정을 저장하지 못했습니다.")}
    finally{setSaving("")}
  };

  return <main className="settings-app">
    <header className="settings-header"><a href="/kiosk"><b>正</b><span>정일품 설정<small>운영자 전용</small></span></a><nav><a href="/kiosk">키오스크</a><a href="/admin">판매장</a><a href="/workshop">작업장</a></nav></header>
    <section className="settings-intro"><small>APP SETTINGS</small><h1>앱에서 바로 수정하세요</h1><p>저장한 상품 정보와 판매 일정은 키오스크에 즉시 반영됩니다.</p></section>
    {loading&&<div className="settings-loading">설정을 불러오고 있습니다…</div>}
    {error&&<div className="access-error"><b>설정 화면에 연결할 수 없습니다</b><span>{error}</span><a href="/signin-with-chatgpt?return_to=/settings">운영자 로그인</a></div>}
    {!loading&&!error&&<>
      <section className="settings-section">
        <div className="settings-title"><div><small>SEASON</small><h2>판매 일정</h2></div><p>현재 운영 중인 명절 예약 기간입니다.</p></div>
        {seasons.map(item=><article className="season-editor" key={item.id}>
          <label><span>시즌명</span><input value={item.name} onChange={e=>updateSeason(item.id,"name",e.target.value)}/></label>
          <label><span>명절 날짜</span><input type="date" value={item.holidayDate} onChange={e=>updateSeason(item.id,"holidayDate",e.target.value)}/></label>
          <label><span>판매 시작</span><input type="date" value={item.salesStartDate} onChange={e=>updateSeason(item.id,"salesStartDate",e.target.value)}/></label>
          <label><span>판매 종료</span><input type="date" value={item.salesEndDate} onChange={e=>updateSeason(item.id,"salesEndDate",e.target.value)}/></label>
          <label className="settings-toggle"><input type="checkbox" checked={item.active} onChange={e=>updateSeason(item.id,"active",e.target.checked)}/><span>현재 시즌으로 사용</span></label>
          <button onClick={()=>saveSeason(item)} disabled={saving===item.id}>{saving===item.id?"저장 중…":"판매 일정 저장"}</button>
        </article>)}
      </section>
      <section className="settings-section">
        <div className="settings-title"><div><small>PRODUCTS</small><h2>상품 관리</h2></div><p>가격은 숫자로 입력하고, 사진 URL은 준비된 뒤 추가할 수 있습니다.</p></div>
        <div className="product-editors">{products.map(item=><article className="product-editor" key={item.id}>
          <header><div><small>{item.code}</small><h3>{item.name}</h3></div><label className="settings-toggle"><input type="checkbox" checked={item.active} onChange={e=>updateProduct(item.id,"active",e.target.checked)}/><span>{item.active?"노출 중":"숨김"}</span></label></header>
          <div className="editor-grid">
            <label><span>상품명</span><input value={item.name} onChange={e=>updateProduct(item.id,"name",e.target.value)}/></label>
            <label><span>카테고리</span><select value={item.category} onChange={e=>updateProduct(item.id,"category",e.target.value)}>{["진공세트","프리미엄","LA갈비","뼈세트","O'meat"].map(category=><option key={category}>{category}</option>)}</select></label>
            <label><span>가격</span><input type="number" min="1" value={item.price} onChange={e=>updateProduct(item.id,"price",Number(e.target.value))}/></label>
            <label><span>노출 순서</span><input type="number" value={item.displayOrder} onChange={e=>updateProduct(item.id,"displayOrder",Number(e.target.value))}/></label>
            <label><span>구성·중량</span><input value={item.customerDisplayWeight??""} onChange={e=>updateProduct(item.id,"customerDisplayWeight",e.target.value)}/></label>
            <label><span>배지</span><input value={item.badge??""} onChange={e=>updateProduct(item.id,"badge",e.target.value)} placeholder="예: BEST"/></label>
            <label className="wide"><span>한 줄 설명</span><input value={item.subtitle} onChange={e=>updateProduct(item.id,"subtitle",e.target.value)}/></label>
            <label className="wide"><span>상세 설명</span><textarea value={item.description} onChange={e=>updateProduct(item.id,"description",e.target.value)}/></label>
            <label className="wide"><span>제품 사진 URL</span><input value={item.imageUrl??""} onChange={e=>updateProduct(item.id,"imageUrl",e.target.value)} placeholder="https://..."/></label>
          </div>
          <button className="save-product" onClick={()=>saveProduct(item)} disabled={saving===item.id}>{saving===item.id?"저장 중…":"이 상품 저장"}</button>
        </article>)}</div>
      </section>
    </>}
    {notice&&<div className="ops-toast" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="알림 닫기">×</button></div>}
  </main>;
}