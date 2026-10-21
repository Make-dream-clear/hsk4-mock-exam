'use strict';
module.exports = function revisionPanel(){
 return `<!-- WRITING REVISION -->
 <style>#essay-revision{line-height:1.75;overflow-wrap:anywhere;scroll-margin-top:90px}#essay-revision p{margin:12px 0}#essay-revision button{white-space:normal;max-width:100%;min-height:44px;line-height:1.5;margin:8px 0}#essay-revision select{box-sizing:border-box;width:100%;min-height:44px;font:inherit;background:var(--paper);color:var(--ink)}#essay-revision input[type=checkbox]{appearance:auto;width:18px;height:18px;vertical-align:middle}#essay-revision [hidden]{display:none!important}#essay-revision summary{cursor:pointer;padding:12px 0}</style>
 <section id="essay-revision" style="border:1px solid var(--mist);border-radius:12px;padding:18px;margin:22px 0;">
 <h3>Improve one thing / 每次改好一个地方</h3>
 <p>先写草稿，再选一个目标。保留修改前的文字，在上方编辑，最后对照检查。Write a draft, choose one goal, edit above, then compare.</p>
 <label for="revision-goal">This revision’s goal / 本轮修改目标</label>
 <select id="revision-goal" aria-describedby="revision-tip" style="max-width:100%;white-space:normal;"><option value="detail">补具体细节 / Add a useful detail</option><option value="structure">理清事情顺序 / Clarify the sequence</option><option value="connection">说明原因或联系 / Explain the connection</option></select>
 <p id="revision-tip"></p>
 <button type="button" class="btn btn-secondary" id="revision-start">Save current draft and begin / 保留当前稿，开始修改</button>
 <div id="revision-work" hidden>
 <details><summary>Before this revision / 修改前的草稿</summary><p id="revision-before" style="white-space:pre-wrap;overflow-wrap:anywhere;"></p></details>
 <p>在上方短文框修改，不会覆盖这里保留的旧稿。Edit the essay above; the snapshot here stays unchanged.</p><a class="btn btn-ghost" href="#essay-input" id="revision-edit">Back to my draft / 返回草稿继续修改</a>
 <label style="display:block;padding:12px 0;"><input id="revision-check" type="checkbox"> 我已对照前后两稿，检查是否解决了本轮问题。 / I compared both versions against this goal.</label>
 <button type="button" class="btn btn-primary" id="revision-done">Review my revision / 完成修改自查</button>
 <button type="button" class="btn btn-ghost" id="revision-cancel">Cancel this goal, keep draft / 取消本轮，保留当前稿</button>
 </div>
 <p id="revision-feedback" role="status" tabindex="-1"></p>
 <p style="font-size:13px;color:var(--stone);">只在本浏览器保存，不上传作文。自查不等于老师评分或整篇达标。Saved only in this browser; no essay text is sent. Self-review is not grading.</p>
 </section>
 <!-- /WRITING REVISION -->`;
};
