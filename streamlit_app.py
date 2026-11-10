"""Review Signal: serves the static project site (site/*.html) inside Streamlit.
All five pages are packed into one component (bundle kept on the parent window); header links swap the frame's page
(Streamlit's sandbox does not allow the frame to navigate the browser tab) and update ?page= for shareable links."""
import json
import pathlib
import streamlit as st
import streamlit.components.v1 as components

SITE = pathlib.Path(__file__).parent / "site"
PAGES = ["index", "studies", "model", "method", "forward"]

st.set_page_config(page_title="Review Signal", page_icon=str(pathlib.Path(__file__).parent / "favicon.png"), layout="wide", initial_sidebar_state="collapsed")
st.markdown("""<style>
header[data-testid="stHeader"], [data-testid="stSidebar"], [data-testid="stSidebarCollapsedControl"] {display:none}
.block-container {padding:0 !important; max-width:100% !important}
iframe {display:block; border:0}
</style>""", unsafe_allow_html=True)

start = st.query_params.get("page", "index")
if start not in PAGES:
    start = "index"

GLUE = r"""
const RS = window.parent.__RS;
function render(page) {
  let html = RS.pages[page];
  const app = RS.app.replace('(location.pathname.split("/").pop() || "index.html")', '("' + page + '.html")');
  html = html.replace('<link rel="stylesheet" href="assets/style.css">', () => "<style>" + RS.css + "</style>")
             .replace('<script src="assets/data.js" defer><\/script>', "").replace('<script src="assets/app.js" defer><\/script>', "")
             .replace("</body>", () => "<script>" + RS.data + "<\/script><script>" + app + "<\/script><script>" + RS.glue + "<\/script></body>");
  return html;
}
function go(page) {
  try { const u = new URL(window.top.location.href); u.searchParams.set("page", page); window.top.history.pushState(null, "", u); window.top.scrollTo(0, 0); } catch (e) {}
  window.frameElement.srcdoc = render(page);
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a) return;
  const m = (a.getAttribute("href") || "").match(/^([a-z]+)\.html(#.*)?$/);
  if (!m || !RS.pages[m[1]]) return;
  e.preventDefault(); go(m[1]);
});
function fit() {
  try {
    const f = window.frameElement, last = document.querySelector("footer") || document.body.lastElementChild;
    if (f && last) f.style.height = Math.ceil(last.getBoundingClientRect().bottom + window.scrollY + 24) + "px";
  } catch (e) {}
}
new ResizeObserver(fit).observe(document.documentElement); addEventListener("load", fit); setTimeout(fit, 300);
"""


def bundle(start: str) -> str:
    rs = {"css": (SITE / "assets/style.css").read_text(encoding="utf-8"),
          "data": (SITE / "assets/data.js").read_text(encoding="utf-8"),
          "app": (SITE / "assets/app.js").read_text(encoding="utf-8"),
          "pages": {p: (SITE / f"{p}.html").read_text(encoding="utf-8") for p in PAGES},
          "glue": GLUE}
    full = json.dumps(rs).replace("<", "\\u003c")
    return ("<!doctype html><html><body><script>window.parent.__RS=" + full + ";" + GLUE +
            ";window.frameElement.srcdoc=render(" + json.dumps(start) + ");</script></body></html>")


components.html(bundle(start), height=2400, scrolling=True)
