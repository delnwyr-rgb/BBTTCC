// BBTTCC Sorting Wizard Step 0
// Drop-in UI for the existing sorting engine.
// Requires:
//   game.bbttcc.api.sorting.loadSpec
//   game.bbttcc.api.sorting.runTest
//   game.bbttcc.api.sorting.runAndCreate
//
// Suggested path:
// modules/bbttcc-sorting-engine/scripts/wizard-step0-sorting.js

(function () {
  "use strict";

  var APP_ID = "bbttcc-sorting-wizard";
  var LOG_PREFIX = "[bbttcc-sorting-wizard]";

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    console.log.apply(console, args);
  }

  function warn() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    console.warn.apply(console, args);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function titleCase(s) {
    return String(s || "")
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }

  function getSortingApi() {
    return game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.sorting : null;
  }

  function ensureStyleOnce() {
    if (document.getElementById("bbttcc-sorting-wizard-style")) return;

    var style = document.createElement("style");
    style.id = "bbttcc-sorting-wizard-style";
    style.textContent = `
      #bbttcc-sorting-wizard,
      #bbttcc-sorting-wizard .window-content {
        height: 100%;
      }
      #bbttcc-sorting-wizard .window-content {
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0;
      }
      .bbttcc-sorter {
        padding: 22px 26px 26px 26px;
        color: #f3f4f6;
        background: linear-gradient(180deg, rgba(8,18,44,0.96), rgba(5,11,29,0.96));
        min-height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .bbttcc-sorter h1,
      .bbttcc-sorter h2,
      .bbttcc-sorter h3 {
        margin: 0 0 10px 0;
        color: #fff;
      }
      .bbttcc-sorter .subtitle {
        opacity: 0.85;
        margin-bottom: 14px;
      }
      .bbttcc-sorter .progress {
        margin-bottom: 14px;
        font-size: 12px;
        opacity: 0.85;
      }
      .bbttcc-sorter .question-card,
      .bbttcc-sorter .result-card {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        padding: 18px 18px 16px 18px;
        background: rgba(255,255,255,0.03);
      }
      .bbttcc-sorter .prompt {
        font-size: 22px;
        line-height: 1.45;
        margin-bottom: 18px;
        color: #fff;
      }
      .bbttcc-sorter .answers {
        display: grid;
        gap: 10px;
      }
      .bbttcc-sorter .answer {
        display: block;
        width: 100%;
        text-align: left;
        padding: 14px 18px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.04);
        color: #fff;
        cursor: pointer;
        font-size: 18px;
        line-height: 1.4;
      }
      .bbttcc-sorter .answer:hover {
        background: rgba(255,255,255,0.08);
      }
      .bbttcc-sorter .answer.active {
        border-color: rgba(120,170,255,0.9);
        background: rgba(80,120,255,0.18);
      }
      .bbttcc-sorter .answer-key {
        display: inline-block;
        width: 28px;
        font-weight: 700;
      }
      .bbttcc-sorter .footer {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 14px;
      }
      .bbttcc-sorter .footer-right {
        display: flex;
        gap: 8px;
      }
      .bbttcc-sorter button {
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.06);
        color: #fff;
        padding: 8px 12px;
        cursor: pointer;
      }
      .bbttcc-sorter button.primary {
        background: rgba(90,130,255,0.32);
        border-color: rgba(120,170,255,0.9);
      }
      .bbttcc-sorter button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .bbttcc-sorter .stack-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 16px;
        margin: 12px 0 16px 0;
      }
      .bbttcc-sorter .stack-item {
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .bbttcc-sorter .label {
        opacity: 0.72;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .bbttcc-sorter .value {
        margin-top: 2px;
        font-size: 16px;
        color: #fff;
      }
      .bbttcc-sorter .blurb {
        margin-top: 12px;
        line-height: 1.45;
      }
      .bbttcc-sorter .top-traits {
        margin-top: 12px;
        padding-left: 18px;
      }
      .bbttcc-sorter .result-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  class BBTTCCSortingWizard extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: APP_ID,
      tag: "section",
      window: {
        title: "BBTTCC Sorting Wizard",
        resizable: true
      },
      position: {
        width: 980,
        height: 860
      }
    };

    constructor(options) {
      super(options || {});
      this.spec = null;
      this.index = 0;
      this.answers = {};
      this.resultBundle = null;
      this.createdActor = null;
      this.onUseResult = (options && typeof options.onUseResult === "function") ? options.onUseResult : null;
      this.prefillName = (options && options.name) ? String(options.name) : "Sorted Hero";
      this.prefillFactionId = (options && options.factionId) ? String(options.factionId) : "";
    }

    async _loadSpec() {
      var api = getSortingApi();
      if (!api || typeof api.loadSpec !== "function") {
        throw new Error("Sorting API not available.");
      }
      this.spec = await api.loadSpec();
    }

    async _renderHTML(context, options) {
      ensureStyleOnce();

      if (!this.spec) {
        await this._loadSpec();
      }

      return this.resultBundle ? this._renderResultView() : this._renderQuestionView();
    }

    async _replaceHTML(result, content, options) {
      content.innerHTML = result;
    }

    async _onRender(context, options) {
      await super._onRender(context, options);

      var content = this.element.querySelector(".window-content") || this.element;
      if (!content) return;

      this._wire();
    }

    _renderQuestionView() {
      var q = this.spec.questions[this.index];
      var current = this.answers[String(q.id)] || "";
      var answeredCount = Object.keys(this.answers).length;
      var answersHtml = "";
      var key;
      var ans;

      for (key in q.answers) {
        if (!Object.prototype.hasOwnProperty.call(q.answers, key)) continue;
        ans = q.answers[key];
        answersHtml +=
          "<button type='button' class='answer" + (current === key ? " active" : "") + "' data-action='pick' data-key='" + esc(key) + "'>" +
            "<span class='answer-key'>" + esc(key) + ".</span> " +
            "<span>" + esc(ans.text) + "</span>" +
          "</button>";
      }

      return "" +
        "<div class='bbttcc-sorter'>" +
          "<h1>Who Are You Under Pressure?</h1>" +
          "<div class='subtitle'>Choose the answer that feels most true when the roof is on fire.</div>" +
          "<div class='progress'>Question " + (this.index + 1) + " of " + this.spec.questions.length + " • " + answeredCount + " answered</div>" +
          "<div class='question-card'>" +
            "<div class='prompt'>" + esc(q.prompt) + "</div>" +
            "<div class='answers'>" + answersHtml + "</div>" +
            "<div class='footer'>" +
              "<div>" +
                "<button type='button' data-action='retake'>Reset</button>" +
              "</div>" +
              "<div class='footer-right'>" +
                "<button type='button' data-action='prev' " + (this.index === 0 ? "disabled" : "") + ">Back</button>" +
                "<button type='button' class='primary' data-action='next'>" +
                  (this.index === this.spec.questions.length - 1 ? "Reveal Result" : "Next") +
                "</button>" +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>";
    }

    _renderResultView() {
      var result = this.resultBundle.result;
      var short = result.short;
      var topTraits = result.topTraits || [];
      var traitHtml = "";
      var i;

      for (i = 0; i < topTraits.length; i++) {
        traitHtml += "<li><b>" + esc(titleCase(topTraits[i][0])) + ":</b> " + esc(String(topTraits[i][1])) + "</li>";
      }

      return "" +
        "<div class='bbttcc-sorter'>" +
          "<h1>Your BBTTCC Identity Stack</h1>" +
          "<div class='subtitle'>Tell me how you solve problems, and I’ll tell you what you are.</div>" +
          "<div class='result-card'>" +
            "<div class='stack-grid'>" +
              this._stackItem("Philosophy", short.philosophy) +
              this._stackItem("Alignment", short.alignment) +
              this._stackItem("Archetype", short.archetype) +
              this._stackItem("Crew Type", short.crew) +
              this._stackItem("Occult Association", short.occult) +
              this._stackItem("Suggested Class", short.class) +
              this._stackItem("Suggested Ancestry", short.ancestry) +
            "</div>" +

            "<h3>What this means</h3>" +
            "<div class='blurb'>" + esc(result.expanded.meaning) + "</div>" +

            "<h3 style='margin-top:14px;'>What you are good at</h3>" +
            "<div class='blurb'>" + esc(result.expanded.strengths) + "</div>" +

            "<h3 style='margin-top:14px;'>What may break you</h3>" +
            "<div class='blurb'>" + esc(result.expanded.breaks) + "</div>" +

            "<h3 style='margin-top:14px;'>Mal's Verdict</h3>" +
            "<div class='blurb'><i>" + esc(result.expanded.malVerdict) + "</i></div>" +

            "<h3 style='margin-top:14px;'>Top Traits</h3>" +
            "<ul class='top-traits'>" + traitHtml + "</ul>" +

            "<div class='result-actions'>" +
              "<button type='button' data-action='backToQuiz'>Back To Quiz</button>" +
              "<button type='button' data-action='reroll'>Retake</button>" +
              "<button type='button' data-action='postChat'>Post Result To Chat</button>" +
              "<button type='button' class='primary' data-action='createActor'>" +
                (this.onUseResult ? "Use In Character Wizard" : "Use This Character") +
              "</button>" +
            "</div>" +
          "</div>" +
        "</div>";
    }

    _stackItem(label, value) {
      return "" +
        "<div class='stack-item'>" +
          "<div class='label'>" + esc(label) + "</div>" +
          "<div class='value'>" + esc(titleCase(value)) + "</div>" +
        "</div>";
    }

    _wire() {
      var content = this.element.querySelector(".window-content") || this.element;
      var self = this;

      content.querySelectorAll("[data-action='pick']").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          var key = ev.currentTarget.dataset.key;
          var q = self.spec.questions[self.index];
          self.answers[String(q.id)] = key;
          self.render(true);
        });
      });

      this._bind(content, "prev", function () {
        if (self.index > 0) self.index -= 1;
        self.render(true);
      });

      this._bind(content, "next", async function () {
        var q = self.spec.questions[self.index];
        if (!self.answers[String(q.id)]) {
          ui.notifications.warn("Pick an answer first.");
          return;
        }

        if (self.index < self.spec.questions.length - 1) {
          self.index += 1;
          self.render(true);
          return;
        }

        await self._computeResult();
      });

      this._bind(content, "retake", function () {
        self.index = 0;
        self.answers = {};
        self.resultBundle = null;
        self.render(true);
      });

      this._bind(content, "reroll", function () {
        self.index = 0;
        self.answers = {};
        self.resultBundle = null;
        self.render(true);
      });

      this._bind(content, "backToQuiz", function () {
        self.resultBundle = null;
        self.render(true);
      });

      this._bind(content, "postChat", async function () {
        if (!self.resultBundle) return;
        var api = getSortingApi();
        await api.runTest(self.answers, { chat: true });
      });

      this._bind(content, "createActor", async function () {
        var api = getSortingApi();
        var actorName = self.prefillName || "Sorted Hero";

        try {
          if (self.onUseResult && self.resultBundle && typeof self.onUseResult === "function") {
            var payload = await api.buildGuidedPayloadFromResult(self.resultBundle.result, {
              factionId: self.prefillFactionId || ""
            });

            log("Sending payload to Character Wizard", payload);
            await self.onUseResult(payload, self.resultBundle);
            ui.notifications.info("Sorting result sent to Character Wizard.");
            self.close();
            return;
          }

          var name = await Dialog.prompt({
            title: "Create Character",
            content: "<p>Name this character.</p><input type='text' id='bbttcc-sorting-actor-name' name='actor-name' value='" + esc(actorName) + "' style='width:100%;'/>",
            ok: {
              label: "Create",
              callback: function (html) {
                try {
                  var v = "";

                  if (html && typeof html.find === "function") {
                    var jq = html.find("#bbttcc-sorting-actor-name");
                    if (jq && jq.length) v = jq.val();
                    if (!v) {
                      jq = html.find("[name='actor-name']");
                      if (jq && jq.length) v = jq.val();
                    }
                  }

                  if (!v && typeof document !== "undefined") {
                    var el = document.getElementById("bbttcc-sorting-actor-name");
                    if (el) v = el.value;
                  }

                  v = String(v || "").trim();
                  return v || actorName;
                } catch (_err) {
                  return actorName;
                }
              }
            },
            rejectClose: false
          });

          name = String(name || "").trim();
          if (!name || name.toLowerCase() === "ok") name = actorName;

          var bundle = await api.runAndCreate(self.answers, {
            chat: true,
            name: name
          });
          self.createdActor = bundle.actor || null;
          ui.notifications.info("Character created.");
          self.close();
        } catch (err) {
          console.error(err);
          ui.notifications.error("Character creation failed. Check console.");
        }
      });
    }

    _bind(root, action, fn) {
      var nodes = root.querySelectorAll("[data-action='" + action + "']");
      nodes.forEach(function (node) {
        node.addEventListener("click", function (ev) {
          ev.preventDefault();
          fn(ev);
        });
      });
    }

    async _computeResult() {
      var api = getSortingApi();
      if (!api) {
        ui.notifications.error("Sorting API unavailable.");
        return;
      }

      try {
        this.resultBundle = await api.runTest(this.answers, { chat: false });
        this.render(true);
      } catch (err) {
        console.error(err);
        ui.notifications.error("Failed to compute sorting result.");
      }
    }
  }

  Hooks.once("ready", function () {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.sorting = game.bbttcc.api.sorting || {};

    game.bbttcc.api.sorting.openWizard = function (options) {
      var app = new BBTTCCSortingWizard(options || {});
      app.render(true);
      return app;
    };

    log("Wizard API ready at game.bbttcc.api.sorting.openWizard()");
  });
})();