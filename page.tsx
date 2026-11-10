"use client";

import { useEffect, useMemo, useState } from "react";
import { configured, supabase } from "@/lib/supabase";

type Pooja = { id: string; name: string; name_te: string | null; price: number; active: boolean };
type Family = { name: string; relationship: string };
type Booking = {
  id: string; receipt_no: string; devotee_name: string; mobile: string; gotram: string;
  pooja_name: string; amount: number; payment_method: string; payment_status: string;
  booking_date: string; created_at: string;
};

const initialPoojas = [
  ["Archana", "అర్చన"], ["Abhishekam", "అభిషేకం"], ["Vahana Puja", "వాహన పూజ"],
  ["Nitya Archana", "నిత్య అర్చన"], ["Kalyanam", "కళ్యాణం"]
];

export default function Home() {
  const [poojas, setPoojas] = useState<Pooja[]>([]);
  const [mode, setMode] = useState<"book" | "staff">("book");
  const [lang, setLang] = useState<"en" | "te">("en");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<any>(null);
  const [staffRows, setStaffRows] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [staffTab, setStaffTab] = useState<"bookings" | "poojas" | "media">("bookings");
  const [media, setMedia] = useState<File | null>(null);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaRows, setMediaRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "", gotram: "", mobile: "", address: "", pooja_id: "", booking_date: new Date().toISOString().slice(0,10),
    amount: "", payment_method: "Cash", payment_status: "Pending", notes: ""
  });
  const [family, setFamily] = useState<Family[]>([]);
  const [ticket, setTicket] = useState<any>(null);
  const [login, setLogin] = useState({ email: "", password: "" });

  const t = (en: string, te: string) => lang === "en" ? en : te;

  useEffect(() => {
    loadPoojas();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) { loadBookings(); loadMedia(); }
  }, [session]);

  async function loadPoojas() {
    const { data, error } = await supabase.from("poojas").select("*").eq("active", true).order("sort_order");
    if (error) { setMessage("Database is not connected yet. Follow SETUP.md to connect Supabase."); return; }
    setPoojas(data || []);
    if (data?.length) setForm(f => ({ ...f, pooja_id: f.pooja_id || data[0].id, amount: f.amount || String(data[0].price) }));
  }

  function choosePooja(id: string) {
    const p = poojas.find(x => x.id === id);
    setForm(f => ({ ...f, pooja_id: id, amount: p ? String(p.price) : "" }));
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    if (!/^[0-9]{10}$/.test(form.mobile)) { setMessage("Enter a valid 10-digit mobile number."); setLoading(false); return; }
    if (!form.pooja_id) { setMessage("Please select a pooja."); setLoading(false); return; }
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_name: form.name.trim(), p_gotram: form.gotram.trim(), p_mobile: form.mobile.trim(),
      p_address: form.address.trim(), p_pooja_id: form.pooja_id,
      p_booking_date: form.booking_date, p_amount: Number(form.amount),
      p_payment_method: form.payment_method, p_payment_status: form.payment_status,
      p_notes: form.notes.trim(), p_family: family
    });
    if (error) setMessage(error.message);
    else {
      const selected = poojas.find(p => p.id === form.pooja_id);
      setTicket({
        receipt_no: data.receipt_no,
        name: form.name.trim(),
        gotram: form.gotram.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim(),
        pooja_name: selected?.name || "",
        booking_date: form.booking_date,
        amount: selected?.price ?? Number(form.amount),
        payment_method: form.payment_method,
        payment_status: "Pending",
        family: family.filter(m => m.name.trim())
      });
      setMessage("Booking successful. Your ticket is ready.");
      setForm(f => ({ ...f, name:"", gotram:"", mobile:"", address:"", notes:"" }));
      setFamily([]);
    }
    setLoading(false);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword(login);
    setMessage(error ? error.message : "Signed in.");
    setLoading(false);
  }
  async function signOut() { await supabase.auth.signOut(); setSession(null); setStaffRows([]); }

  async function loadBookings() {
    const { data, error } = await supabase.from("booking_register").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) setMessage(error.message); else setStaffRows(data || []);
  }
  async function updatePayment(id: string, status: string) {
    const { error } = await supabase.from("bookings").update({ payment_status: status }).eq("id", id);
    setMessage(error ? error.message : "Payment status updated.");
    loadBookings();
  }
  async function savePoojaPrice(id: string, price: string, active: boolean) {
    const { error } = await supabase.from("poojas").update({ price: Number(price), active }).eq("id", id);
    setMessage(error ? error.message : "Pooja settings saved.");
    loadPoojas();
  }
  async function uploadMedia(e: React.FormEvent) {
    e.preventDefault();
    if (!media) return;
    setLoading(true);
    const safeName = media.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("temple-media").upload(path, media);
    if (uploadError) { setMessage(uploadError.message); setLoading(false); return; }
    const { data: urlData } = supabase.storage.from("temple-media").getPublicUrl(path);
    const { error } = await supabase.from("media_library").insert({ title: mediaTitle || media.name, file_path: path, public_url: urlData.publicUrl, mime_type: media.type });
    setMessage(error ? error.message : "Media uploaded.");
    setMedia(null); setMediaTitle(""); setLoading(false); loadMedia();
  }
  async function loadMedia() {
    const { data, error } = await supabase.from("media_library").select("*").order("created_at", { ascending: false });
    if (!error) setMediaRows(data || []);
  }
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return staffRows.filter(r => [r.receipt_no,r.devotee_name,r.mobile].some(v => String(v || "").toLowerCase().includes(q)));
  }, [staffRows, query]);

  if (!configured) return <main className="shell"><header className="hero"><div className="templemark">ॐ</div><p className="eyebrow">LALAPET · TELANGANA</p><h1>Sri Hanuman Sri Ramalingeshwara Devalayam</h1><p>Online Pooja Booking & Temple Management</p></header><section className="panel"><h2>Website setup is required</h2><p>This is the deployable online application. To activate bookings, history, staff login and shared storage, connect the Supabase project and deploy the site. Follow the included <b>SETUP.md</b>.</p><p>Once configured, devotees can book from this page and temple staff can sign in to manage all bookings.</p></section></main>;

  return <main className="shell">
    <header className="hero">
      <div className="topline"><span className="templemark">ॐ</span><button className="lang" onClick={() => setLang(lang === "en" ? "te" : "en")}>{lang === "en" ? "తెలుగు" : "English"}</button></div>
      <p className="eyebrow">LALAPET · TELANGANA</p>
      <h1>Sri Hanuman Sri Ramalingeshwara Devalayam</h1>
      <p>{t("Online Pooja Booking & Temple Services","ఆన్‌లైన్ పూజా బుకింగ్ మరియు దేవాలయ సేవలు")}</p>
      <nav><button className={mode==="book"?"selected":""} onClick={()=>setMode("book")}>{t("Book a Pooja","పూజ బుక్ చేయండి")}</button><button className={mode==="staff"?"selected":""} onClick={()=>setMode("staff")}>{t("Temple Staff","ఆలయ సిబ్బంది")}</button></nav>
    </header>
    {message && <div className="notice" role="status">{message}</div>}
    {mode === "book" && ticket && <section className="panel ticket" id="ticket">
      <div className="tickethead"><div className="templemark">ॐ</div><p className="eyebrow">LALAPET · TELANGANA</p><h2>Sri Hanuman Sri Ramalingeshwara Devalayam</h2><p>POOJA BOOKING RECEIPT</p></div>
      <div className="ticketbody">
        <div className="receiptno"><span>Receipt Number</span><b>{ticket.receipt_no}</b></div>
        <div className="ticketgrid">
          <div><small>Devotee</small><b>{ticket.name}</b></div>
          <div><small>Gotram</small><b>{ticket.gotram}</b></div>
          <div><small>Mobile</small><b>{ticket.mobile}</b></div>
          <div><small>Pooja</small><b>{ticket.pooja_name}</b></div>
          <div><small>Pooja Date</small><b>{ticket.booking_date}</b></div>
          <div><small>Amount</small><b>₹{ticket.amount}</b></div>
          <div><small>Payment method</small><b>{ticket.payment_method}</b></div>
          <div><small>Payment status</small><b>{ticket.payment_status}</b></div>
        </div>
        {ticket.address && <p><small>Address</small><br/>{ticket.address}</p>}
        {ticket.family?.length > 0 && <p><small>Family members</small><br/>{ticket.family.map((m:Family)=>m.name + (m.relationship ? " ("+m.relationship+")" : "")).join(", ")}</p>}
        <p className="muted">Please keep this receipt and present it at the temple. Payment is to be confirmed by temple staff.</p>
      </div>
      <div className="ticketactions"><button className="primary" onClick={()=>window.print()}>Print / Save ticket</button><button className="secondary" onClick={()=>{setTicket(null);setMessage("");}}>New booking</button></div>
    </section>}
    {mode === "book" && !ticket && <section className="panel">
      <h2>{t("Devotee Registration & Pooja Booking","భక్తుల నమోదు మరియు పూజ బుకింగ్")}</h2>
      <p className="muted">Fields marked * are required. Receipt is generated automatically after successful booking.</p>
      <form onSubmit={submitBooking} className="formgrid">
        <label>{t("Devotee name *","భక్తుని పేరు *")}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></label>
        <label>{t("Gotram *","గోత్రం *")}<input required value={form.gotram} onChange={e=>setForm({...form,gotram:e.target.value})} /></label>
        <label>{t("Mobile number *","మొబైల్ నంబర్ *")}<input required inputMode="numeric" maxLength={10} value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value.replace(/\D/g,"")})} /></label>
        <label>{t("Address (optional)","చిరునామా (ఐచ్ఛికం)")}<textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
        <label>{t("Select pooja *","పూజను ఎంచుకోండి *")}<select required value={form.pooja_id} onChange={e=>choosePooja(e.target.value)}><option value="">Choose a pooja</option>{poojas.map(p=><option key={p.id} value={p.id}>{lang==="en"?p.name:(p.name_te || p.name)} — ₹{p.price}</option>)}</select></label>
        <label>{t("Pooja date *","పూజ తేదీ *")}<input type="date" required value={form.booking_date} onChange={e=>setForm({...form,booking_date:e.target.value})}/></label>
        <label>{t("Amount (₹)","మొత్తం (₹)")}<input type="number" min="0" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
        <label>{t("Payment method","చెల్లింపు విధానం")}<select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}><option>Cash</option><option>UPI</option><option>Other</option></select></label>
        <label>{t("Payment status","చెల్లింపు స్థితి")}<input value="Pending — confirmed by temple staff" readOnly /></label>
        <label className="wide">{t("Family members (optional)","కుటుంబ సభ్యులు (ఐచ్ఛికం)")}<div className="familylist">{family.map((m,i)=><div className="familyrow" key={i}><input placeholder="Member name" value={m.name} onChange={e=>setFamily(f=>f.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/><input placeholder="Relationship" value={m.relationship} onChange={e=>setFamily(f=>f.map((x,j)=>j===i?{...x,relationship:e.target.value}:x))}/><button type="button" className="remove" onClick={()=>setFamily(f=>f.filter((_,j)=>j!==i))}>Remove</button></div>)}<button type="button" className="secondary" onClick={()=>setFamily(f=>[...f,{name:"",relationship:""}])}>+ Add family member</button></div></label>
        <label className="wide">{t("Notes (optional)","గమనికలు")}<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <button className="primary wide" disabled={loading}>{loading?"Submitting…":t("Confirm booking & generate receipt","బుకింగ్ నిర్ధారించి రసీదు పొందండి")}</button>
      </form>
    </section>}
    {mode === "staff" && <section className="panel">
      {!session ? <><h2>Temple staff login</h2><p className="muted">Only authorized temple staff can view booking records and manage poojas.</p><form className="formgrid" onSubmit={signIn}><label>Email<input type="email" required value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/></label><label>Password<input type="password" required value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/></label><button className="primary wide" disabled={loading}>Sign in</button></form></> :
      <><div className="staffhead"><div><h2>Temple dashboard</h2><p className="muted">{session.user.email}</p></div><button className="secondary" onClick={signOut}>Sign out</button></div>
        <div className="tabs"><button className={staffTab==="bookings"?"active":""} onClick={()=>setStaffTab("bookings")}>Bookings & history</button><button className={staffTab==="poojas"?"active":""} onClick={()=>setStaffTab("poojas")}>Pooja setup</button><button className={staffTab==="media"?"active":""} onClick={()=>setStaffTab("media")}>Media library</button></div>
        {staffTab==="bookings" && <><input className="search" placeholder="Search receipt, devotee name or mobile" value={query} onChange={e=>setQuery(e.target.value)}/><div className="tablewrap"><table><thead><tr><th>Receipt</th><th>Devotee</th><th>Mobile</th><th>Pooja</th><th>Date</th><th>Amount</th><th>Payment</th><th>Receipt</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.receipt_no}</td><td>{r.devotee_name}<small>{r.gotram}</small></td><td>{r.mobile}</td><td>{r.pooja_name}</td><td>{r.booking_date}</td><td>₹{r.amount}</td><td><select value={r.payment_status} onChange={e=>updatePayment(r.id,e.target.value)}><option>Pending</option><option>Paid</option></select></td><td><button className="tiny" onClick={()=>window.print()}>Print</button></td></tr>)}</tbody></table>{filtered.length===0&&<p className="muted empty">No bookings found.</p>}</div><button className="secondary" onClick={loadBookings}>Refresh history</button></>}
        {staffTab==="poojas" && <div className="poojalist">{poojas.map(p=><div className="poojarow" key={p.id}><b>{p.name}</b><input aria-label="Price" type="number" min="0" defaultValue={p.price} id={"price-"+p.id}/><button className="tiny" onClick={()=>savePoojaPrice(p.id,(document.getElementById("price-"+p.id) as HTMLInputElement).value,p.active)}>Save price</button></div>)}</div>}
        {staffTab==="media" && <><form className="formgrid" onSubmit={uploadMedia}><label>Media title<input value={mediaTitle} onChange={e=>setMediaTitle(e.target.value)}/></label><label>Photo or video<input type="file" accept="image/*,video/*" required onChange={e=>setMedia(e.target.files?.[0]||null)}/></label><button className="primary wide" disabled={loading}>Upload media</button></form><div className="medialist">{mediaRows.map(m=><div key={m.id}><a href={m.public_url} target="_blank">{m.title}</a><p className="muted">{m.mime_type}</p></div>)}</div></>}
      </>}
    </section>}
    <footer>© Sri Hanuman Sri Ramalingeshwara Devalayam · Lalapet</footer>
  </main>;
}
