/**
 * Free Section Marketplace — Section Catalog
 *
 * Each entry describes one installable section.
 * The `liquid` field is the full OS 2.0 Liquid file content that gets uploaded
 * to /sections/{slug}.liquid in the merchant's theme.
 *
 * Rules for every section:
 *  - Must include {% schema %} with a "presets" array so it appears in Theme Customizer.
 *  - Self-contained CSS via {% stylesheet %} / JS via {% javascript %}.
 *  - Never modifies templates/*.json or theme.liquid.
 *  - Tested against Dawn (Shopify's reference OS 2.0 theme).
 */

// ─── 1. HERO BANNER ───────────────────────────────────────────────────────────
const HERO_BANNER_LIQUID = `
{%- liquid
  assign image             = section.settings.image
  assign overlay_opacity   = section.settings.overlay_opacity | times: 0.01
  assign min_height        = section.settings.min_height
  assign text_alignment    = section.settings.text_alignment
  assign heading           = section.settings.heading
  assign subheading        = section.settings.subheading
  assign button_label      = section.settings.button_label
  assign button_url        = section.settings.button_url
-%}

<section
  id="HeroBanner-{{ section.id }}"
  class="hero-banner hero-banner--align-{{ text_alignment }}"
  style="min-height: {{ min_height }}px;"
>
  {%- if image -%}
    <div class="hero-banner__media">
      {{
        image
        | image_url: width: 1920
        | image_tag:
          loading: 'lazy',
          widths: '375, 550, 750, 1100, 1500, 1780, 2000',
          class: 'hero-banner__image'
      }}
    </div>
  {%- endif -%}

  <div class="hero-banner__overlay" style="opacity: {{ overlay_opacity }};"></div>

  <div class="hero-banner__content page-width">
    {%- if heading != blank -%}
      <h2 class="hero-banner__heading">{{ heading | escape }}</h2>
    {%- endif -%}
    {%- if subheading != blank -%}
      <p class="hero-banner__subheading">{{ subheading | escape }}</p>
    {%- endif -%}
    {%- if button_label != blank -%}
      <a href="{{ button_url | default: '#' }}" class="hero-banner__btn">
        {{- button_label | escape -}}
      </a>
    {%- endif -%}
  </div>
</section>

{% stylesheet %}
.hero-banner {
  position: relative; display: flex; align-items: center;
  overflow: hidden; background: #1a1a1a;
}
.hero-banner__media { position: absolute; inset: 0; }
.hero-banner__image { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-banner__overlay { position: absolute; inset: 0; background: #000; }
.hero-banner__content {
  position: relative; z-index: 1; padding: 6rem 1.5rem;
  color: #fff; width: 100%;
}
.hero-banner--align-center .hero-banner__content { text-align: center; }
.hero-banner--align-left   .hero-banner__content { text-align: left; }
.hero-banner--align-right  .hero-banner__content { text-align: right; }
.hero-banner__heading {
  font-size: clamp(2rem, 5vw, 4.5rem); font-weight: 700;
  line-height: 1.1; margin: 0 0 1rem;
  text-shadow: 0 2px 6px rgba(0,0,0,.4);
}
.hero-banner__subheading {
  font-size: clamp(1rem, 2.5vw, 1.4rem); opacity: .9;
  margin: 0 0 2rem; max-width: 600px;
}
.hero-banner--align-center .hero-banner__subheading { margin-inline: auto; }
.hero-banner__btn {
  display: inline-block; padding: .9rem 2.5rem;
  background: #fff; color: #000; text-decoration: none;
  font-weight: 600; border-radius: 4px;
  border: 2px solid transparent; transition: background .2s, color .2s;
}
.hero-banner__btn:hover { background: transparent; color: #fff; border-color: #fff; }
{% endstylesheet %}

{% schema %}
{
  "name": "Hero Banner",
  "tag": "section",
  "class": "section-hero-banner",
  "settings": [
    { "type": "image_picker", "id": "image", "label": "Background image" },
    {
      "type": "range", "id": "overlay_opacity", "label": "Overlay opacity",
      "min": 0, "max": 80, "step": 5, "default": 40, "unit": "%"
    },
    {
      "type": "range", "id": "min_height", "label": "Minimum height",
      "min": 300, "max": 900, "step": 50, "default": 500, "unit": "px"
    },
    {
      "type": "select", "id": "text_alignment", "label": "Text alignment",
      "options": [
        { "value": "left",   "label": "Left"   },
        { "value": "center", "label": "Center" },
        { "value": "right",  "label": "Right"  }
      ],
      "default": "center"
    },
    { "type": "header", "content": "Content" },
    { "type": "text",     "id": "heading",      "label": "Heading",      "default": "Welcome to Our Store"       },
    { "type": "textarea", "id": "subheading",   "label": "Subheading",   "default": "Discover our latest collection" },
    { "type": "text",     "id": "button_label", "label": "Button label", "default": "Shop Now" },
    { "type": "url",      "id": "button_url",   "label": "Button link"  }
  ],
  "presets": [{ "name": "Hero Banner" }]
}
{% endschema %}
`.trim();

// ─── 2. FAQ ACCORDION ─────────────────────────────────────────────────────────
const FAQ_ACCORDION_LIQUID = `
<section id="FaqAccordion-{{ section.id }}" class="faq-accordion page-width">
  {%- if section.settings.heading != blank -%}
    <h2 class="faq-accordion__heading">{{ section.settings.heading | escape }}</h2>
  {%- endif -%}

  <div class="faq-accordion__list" role="list">
    {%- for block in section.blocks -%}
      <div class="faq-accordion__item" {{ block.shopify_attributes }} role="listitem">
        <button
          class="faq-accordion__question"
          aria-expanded="false"
          aria-controls="FaqAnswer-{{ section.id }}-{{ forloop.index }}"
        >
          <span>{{ block.settings.question | escape }}</span>
          <svg class="faq-accordion__chevron" width="18" height="18" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div
          id="FaqAnswer-{{ section.id }}-{{ forloop.index }}"
          class="faq-accordion__answer"
          hidden
        >
          <div class="faq-accordion__answer-inner">{{ block.settings.answer }}</div>
        </div>
      </div>
    {%- endfor -%}
  </div>
</section>

{% stylesheet %}
.faq-accordion { padding: 4rem 1.5rem; max-width: 800px; margin-inline: auto; }
.faq-accordion__heading {
  font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 700;
  margin: 0 0 2.5rem; text-align: center;
}
.faq-accordion__list { display: flex; flex-direction: column; gap: .5rem; }
.faq-accordion__item { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
.faq-accordion__question {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  gap: 1rem; padding: 1.25rem 1.5rem; background: #fff; border: none;
  cursor: pointer; font-size: 1rem; font-weight: 600; text-align: left; color: inherit;
  transition: background .15s;
}
.faq-accordion__question:hover { background: #f9f9f9; }
.faq-accordion__question[aria-expanded="true"] .faq-accordion__chevron { transform: rotate(180deg); }
.faq-accordion__chevron { flex-shrink: 0; transition: transform .2s ease; }
.faq-accordion__answer[hidden] { display: none; }
.faq-accordion__answer-inner { padding: .25rem 1.5rem 1.25rem; color: #555; line-height: 1.7; }
{% endstylesheet %}

{% javascript %}
(function () {
  var section = document.getElementById('FaqAccordion-{{ section.id }}');
  if (!section) return;
  section.querySelectorAll('.faq-accordion__item').forEach(function (item) {
    var btn    = item.querySelector('.faq-accordion__question');
    var answer = item.querySelector('.faq-accordion__answer');
    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      answer.hidden = expanded;
    });
  });
})();
{% endjavascript %}

{% schema %}
{
  "name": "FAQ Accordion",
  "tag": "section",
  "class": "section-faq-accordion",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Frequently Asked Questions" }
  ],
  "blocks": [
    {
      "type": "faq_item",
      "name": "FAQ Item",
      "settings": [
        { "type": "text",     "id": "question", "label": "Question", "default": "What is your return policy?" },
        { "type": "richtext", "id": "answer",   "label": "Answer",
          "default": "<p>We offer a 30-day return policy. Items must be in their original condition.</p>" }
      ]
    }
  ],
  "presets": [
    {
      "name": "FAQ Accordion",
      "blocks": [
        { "type": "faq_item", "settings": { "question": "What is your return policy?",    "answer": "<p>We offer a 30-day return policy on all items in their original condition.</p>" } },
        { "type": "faq_item", "settings": { "question": "How long does shipping take?",   "answer": "<p>Standard shipping takes 5-7 business days. Expedited shipping is available at checkout.</p>" } },
        { "type": "faq_item", "settings": { "question": "Do you ship internationally?",   "answer": "<p>Yes! We ship to over 50 countries worldwide. International times vary by destination.</p>" } }
      ]
    }
  ]
}
{% endschema %}
`.trim();

// ─── 3. FEATURES GRID ─────────────────────────────────────────────────────────
const FEATURES_GRID_LIQUID = `
<section id="FeaturesGrid-{{ section.id }}" class="features-grid page-width">
  {%- if section.settings.heading != blank or section.settings.subheading != blank -%}
    <div class="features-grid__header">
      {%- if section.settings.heading != blank -%}
        <h2 class="features-grid__heading">{{ section.settings.heading | escape }}</h2>
      {%- endif -%}
      {%- if section.settings.subheading != blank -%}
        <p class="features-grid__subheading">{{ section.settings.subheading | escape }}</p>
      {%- endif -%}
    </div>
  {%- endif -%}

  <div class="features-grid__grid">
    {%- for block in section.blocks -%}
      <div class="features-grid__item" {{ block.shopify_attributes }}>
        <div class="features-grid__icon-wrap">
          {%- if block.settings.icon -%}
            <img
              src="{{ block.settings.icon | image_url: width: 80 }}"
              alt="{{ block.settings.title | escape }}"
              width="40" height="40" loading="lazy"
            >
          {%- else -%}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          {%- endif -%}
        </div>
        <h3 class="features-grid__title">{{ block.settings.title | escape }}</h3>
        <p class="features-grid__description">{{ block.settings.description | escape }}</p>
      </div>
    {%- endfor -%}
  </div>
</section>

{% stylesheet %}
.features-grid { padding: 5rem 1.5rem; }
.features-grid__header { text-align: center; margin-bottom: 3.5rem; }
.features-grid__heading {
  font-size: clamp(1.75rem, 3.5vw, 3rem); font-weight: 700; margin: 0 0 1rem;
}
.features-grid__subheading { font-size: 1.1rem; color: #666; max-width: 600px; margin: 0 auto; }
.features-grid__grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2rem;
}
.features-grid__item {
  text-align: center; padding: 2rem 1.5rem;
  border-radius: 12px; background: #f9f9f9;
}
.features-grid__icon-wrap {
  display: flex; align-items: center; justify-content: center;
  width: 64px; height: 64px; border-radius: 12px;
  background: #111; color: #fff; margin: 0 auto 1.25rem;
}
.features-grid__icon-wrap img { width: 40px; height: 40px; object-fit: contain; }
.features-grid__title { font-size: 1.1rem; font-weight: 600; margin: 0 0 .75rem; }
.features-grid__description { font-size: .95rem; color: #666; line-height: 1.6; margin: 0; }
{% endstylesheet %}

{% schema %}
{
  "name": "Features Grid",
  "tag": "section",
  "class": "section-features-grid",
  "settings": [
    { "type": "text", "id": "heading",    "label": "Heading",    "default": "Why Choose Us" },
    { "type": "text", "id": "subheading", "label": "Subheading", "default": "Everything you need, all in one place" }
  ],
  "blocks": [
    {
      "type": "feature",
      "name": "Feature",
      "settings": [
        { "type": "image_picker", "id": "icon",        "label": "Icon image (optional)" },
        { "type": "text",         "id": "title",       "label": "Title",       "default": "Feature Title" },
        { "type": "text",         "id": "description", "label": "Description", "default": "Describe this feature briefly." }
      ]
    }
  ],
  "presets": [
    {
      "name": "Features Grid",
      "blocks": [
        { "type": "feature", "settings": { "title": "Free Shipping",   "description": "Free shipping on all orders over $50." } },
        { "type": "feature", "settings": { "title": "Easy Returns",    "description": "30-day hassle-free return policy."     } },
        { "type": "feature", "settings": { "title": "Secure Payment",  "description": "Your payment info is always protected." } }
      ]
    }
  ]
}
{% endschema %}
`.trim();

// ─── 4. IMAGE WITH TEXT ───────────────────────────────────────────────────────
const IMAGE_WITH_TEXT_LIQUID = `
{%- liquid
  assign image          = section.settings.image
  assign image_position = section.settings.image_position
  assign image_width    = section.settings.image_width
-%}

<section
  id="ImageWithText-{{ section.id }}"
  class="image-with-text image-with-text--image-{{ image_position }} page-width"
>
  <div class="image-with-text__grid" style="--img-w: {{ image_width }}%;">
    <div class="image-with-text__media">
      {%- if image -%}
        {{
          image
          | image_url: width: 1200
          | image_tag:
            loading: 'lazy',
            widths: '375, 550, 750, 900, 1100',
            class: 'image-with-text__image'
        }}
      {%- else -%}
        <div class="image-with-text__placeholder">
          {{ 'image' | placeholder_svg_tag: 'placeholder-svg' }}
        </div>
      {%- endif -%}
    </div>

    <div class="image-with-text__content">
      {%- if section.settings.subheading != blank -%}
        <p class="image-with-text__eyebrow">{{ section.settings.subheading | escape }}</p>
      {%- endif -%}
      {%- if section.settings.heading != blank -%}
        <h2 class="image-with-text__heading">{{ section.settings.heading | escape }}</h2>
      {%- endif -%}
      {%- if section.settings.text != blank -%}
        <div class="image-with-text__text rte">{{ section.settings.text }}</div>
      {%- endif -%}
      {%- if section.settings.button_label != blank -%}
        <a href="{{ section.settings.button_url | default: '#' }}" class="image-with-text__btn">
          {{- section.settings.button_label | escape -}}
        </a>
      {%- endif -%}
    </div>
  </div>
</section>

{% stylesheet %}
.image-with-text { padding: 4rem 1.5rem; }
.image-with-text__grid {
  display: grid;
  grid-template-columns: var(--img-w, 50%) 1fr;
  gap: 4rem; align-items: center;
}
.image-with-text--image-right .image-with-text__grid {
  grid-template-columns: 1fr var(--img-w, 50%);
}
.image-with-text--image-right .image-with-text__media  { order: 2; }
.image-with-text--image-right .image-with-text__content { order: 1; }
@media (max-width: 749px) {
  .image-with-text__grid,
  .image-with-text--image-right .image-with-text__grid { grid-template-columns: 1fr; gap: 2rem; }
  .image-with-text--image-right .image-with-text__media,
  .image-with-text--image-right .image-with-text__content { order: unset; }
}
.image-with-text__image { width: 100%; height: auto; border-radius: 8px; display: block; }
.image-with-text__placeholder { aspect-ratio: 4/3; background: #f0f0f0; border-radius: 8px; overflow: hidden; }
.image-with-text__eyebrow {
  text-transform: uppercase; letter-spacing: .1em;
  font-size: .85rem; font-weight: 600; color: #666; margin: 0 0 .75rem;
}
.image-with-text__heading {
  font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 700;
  line-height: 1.2; margin: 0 0 1.25rem;
}
.image-with-text__text { color: #555; line-height: 1.7; margin-bottom: 1.75rem; }
.image-with-text__btn {
  display: inline-block; padding: .85rem 2rem; background: #111; color: #fff;
  text-decoration: none; font-weight: 600; border-radius: 4px; transition: opacity .2s;
}
.image-with-text__btn:hover { opacity: .8; }
{% endstylesheet %}

{% schema %}
{
  "name": "Image with Text",
  "tag": "section",
  "class": "section-image-with-text",
  "settings": [
    {
      "type": "select", "id": "image_position", "label": "Image position",
      "options": [
        { "value": "left",  "label": "Left"  },
        { "value": "right", "label": "Right" }
      ],
      "default": "left"
    },
    {
      "type": "range", "id": "image_width", "label": "Image width",
      "min": 30, "max": 70, "step": 5, "default": 50, "unit": "%"
    },
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "header",    "content": "Content" },
    { "type": "text",      "id": "subheading",   "label": "Eyebrow / subheading" },
    { "type": "text",      "id": "heading",      "label": "Heading",      "default": "Image with Text"      },
    { "type": "richtext",  "id": "text",         "label": "Text",
      "default": "<p>Pair large text with an image to tell a story or explain a detail about your product.</p>" },
    { "type": "text",      "id": "button_label", "label": "Button label" },
    { "type": "url",       "id": "button_url",   "label": "Button link"  }
  ],
  "presets": [{ "name": "Image with Text" }]
}
{% endschema %}
`.trim();

// ─── 5. TESTIMONIALS ──────────────────────────────────────────────────────────
const TESTIMONIALS_LIQUID = `
<section id="Testimonials-{{ section.id }}" class="testimonials page-width">
  {%- if section.settings.heading != blank or section.settings.subheading != blank -%}
    <div class="testimonials__header">
      {%- if section.settings.heading != blank -%}
        <h2 class="testimonials__heading">{{ section.settings.heading | escape }}</h2>
      {%- endif -%}
      {%- if section.settings.subheading != blank -%}
        <p class="testimonials__subheading">{{ section.settings.subheading | escape }}</p>
      {%- endif -%}
    </div>
  {%- endif -%}

  <div class="testimonials__grid">
    {%- for block in section.blocks -%}
      <div class="testimonials__card" {{ block.shopify_attributes }}>
        <div class="testimonials__stars" aria-label="{{ block.settings.rating }} out of 5 stars">
          {%- for i in (1..5) -%}
            <svg class="testimonials__star{% if i <= block.settings.rating %} testimonials__star--filled{% endif %}"
                 width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          {%- endfor -%}
        </div>
        <blockquote class="testimonials__quote">"{{ block.settings.quote | escape }}"</blockquote>
        <div class="testimonials__author">
          {%- if block.settings.avatar -%}
            <img
              src="{{ block.settings.avatar | image_url: width: 80 }}"
              alt="{{ block.settings.author_name | escape }}"
              class="testimonials__avatar" width="40" height="40" loading="lazy"
            >
          {%- else -%}
            <div class="testimonials__avatar testimonials__avatar--initial">
              {{ block.settings.author_name | slice: 0, 1 | upcase }}
            </div>
          {%- endif -%}
          <div>
            <p class="testimonials__name">{{ block.settings.author_name | escape }}</p>
            {%- if block.settings.author_title != blank -%}
              <p class="testimonials__role">{{ block.settings.author_title | escape }}</p>
            {%- endif -%}
          </div>
        </div>
      </div>
    {%- endfor -%}
  </div>
</section>

{% stylesheet %}
.testimonials { padding: 5rem 1.5rem; }
.testimonials__header { text-align: center; margin-bottom: 3.5rem; }
.testimonials__heading {
  font-size: clamp(1.75rem, 3.5vw, 3rem); font-weight: 700; margin: 0 0 1rem;
}
.testimonials__subheading { font-size: 1.1rem; color: #666; margin: 0; }
.testimonials__grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;
}
.testimonials__card {
  padding: 2rem; border-radius: 12px; border: 1px solid #e5e5e5;
  background: #fff; display: flex; flex-direction: column; gap: 1rem;
}
.testimonials__stars { display: flex; gap: .2rem; }
.testimonials__star        { fill: #ddd; }
.testimonials__star--filled { fill: #f59e0b; }
.testimonials__quote {
  font-size: 1rem; line-height: 1.7; color: #333; margin: 0; flex: 1; font-style: italic;
}
.testimonials__author { display: flex; align-items: center; gap: .75rem; }
.testimonials__avatar {
  width: 40px; height: 40px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
}
.testimonials__avatar--initial {
  background: #111; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 1rem;
}
.testimonials__name { font-weight: 600; font-size: .95rem; margin: 0; }
.testimonials__role { font-size: .85rem; color: #888; margin: 0; }
{% endstylesheet %}

{% schema %}
{
  "name": "Testimonials",
  "tag": "section",
  "class": "section-testimonials",
  "settings": [
    { "type": "text", "id": "heading",    "label": "Heading",    "default": "What Our Customers Say" },
    { "type": "text", "id": "subheading", "label": "Subheading" }
  ],
  "blocks": [
    {
      "type": "testimonial",
      "name": "Testimonial",
      "settings": [
        {
          "type": "range", "id": "rating", "label": "Star rating",
          "min": 1, "max": 5, "step": 1, "default": 5
        },
        { "type": "textarea",     "id": "quote",        "label": "Quote",         "default": "This product exceeded all my expectations!" },
        { "type": "image_picker", "id": "avatar",       "label": "Author avatar"  },
        { "type": "text",         "id": "author_name",  "label": "Author name",   "default": "Jane D."           },
        { "type": "text",         "id": "author_title", "label": "Title/Company", "default": "Verified Customer" }
      ]
    }
  ],
  "presets": [
    {
      "name": "Testimonials",
      "blocks": [
        { "type": "testimonial", "settings": { "quote": "Absolutely love this product! Quality exceeded my expectations.", "author_name": "Sarah M.", "author_title": "Verified Customer", "rating": 5 } },
        { "type": "testimonial", "settings": { "quote": "Fast shipping and great service. Will definitely buy again!",    "author_name": "James T.", "author_title": "Verified Customer", "rating": 5 } },
        { "type": "testimonial", "settings": { "quote": "The best purchase I've made this year. Highly recommend!",       "author_name": "Emily R.", "author_title": "Verified Customer", "rating": 5 } }
      ]
    }
  ]
}
{% endschema %}
`.trim();

// ─── Catalog Export ───────────────────────────────────────────────────────────
export const SECTIONS_CATALOG = [
  {
    slug:        "hero-banner",
    name:        "Hero Banner",
    description: "Full-width hero section with background image, overlay, heading, subheading, and CTA button. Fully configurable in Theme Customizer.",
    category:    "Marketing",
    liquid:      HERO_BANNER_LIQUID,
  },
  {
    slug:        "faq-accordion",
    name:        "FAQ Accordion",
    description: "Expandable FAQ section with blocks. Add as many Q&A pairs as you need directly in Theme Customizer.",
    category:    "Content",
    liquid:      FAQ_ACCORDION_LIQUID,
  },
  {
    slug:        "features-grid",
    name:        "Features Grid",
    description: "Responsive feature-highlights grid with optional icon images, titles, and descriptions. Ideal for showcasing store benefits.",
    category:    "Content",
    liquid:      FEATURES_GRID_LIQUID,
  },
  {
    slug:        "image-with-text",
    name:        "Image with Text",
    description: "Side-by-side image and text layout. Configurable image position (left/right) and width. Stacks on mobile.",
    category:    "Content",
    liquid:      IMAGE_WITH_TEXT_LIQUID,
  },
  {
    slug:        "testimonials",
    name:        "Testimonials",
    description: "Customer testimonial cards with star ratings, quotes, and author avatars. Responsive grid layout.",
    category:    "Social Proof",
    liquid:      TESTIMONIALS_LIQUID,
  },
];

/** Lookup a section by slug — returns undefined if not found */
export function getSectionBySlug(slug) {
  return SECTIONS_CATALOG.find((s) => s.slug === slug);
}
