let checkedImageLinks = new Map();

const validKeys = [
	'title',
	'type',
	'description',
	'url',
	'timestamp',
	'color',
	'footer',
	'image',
	'thumbnail',
	'author',
	'fields',
];

/**
 * @typedef {Object} CheckResult
 * @property {string[]} warnings A list of warnings
 * @property {string[]} errors A list of errors
 */

/**
 * Check an embed JSON
 * @async
 * @param {string} data The data as a string
 * @returns {CheckResult}
 */
async function checkJSON(data) {
	let json = undefined,
		warnings = [],
		errors = [];
	try {
		json = JSON.parse(data);
	} catch (e) {}

	if (!json)
		return {
			warnings: [],
			errors: ['JSON is invalid'],
		};

	const {
		title,
		description,
		url,
		timestamp,
		color,
		footer,
		image,
		thumbnail,
		author,
		fields,
	} = json;

	// Valid title
	errors.push(getStringErrors(title, 'Title', true, 256));

	// Valid description
	errors.push(getStringErrors(description, 'Description', true, 4096));

	// Valid URL
	if (url && !isValidURL(url)) errors.push('URL is invalid');
	if (isStringEmpty(title) && url)
		warnings.push('URL will not be shown if there is no title');

	// Valid timestamp
	if (timestamp && !isISODate(timestamp)) errors.push('Timestamp is invalid');

	// Valid color
	if (color && !isValidColor(color)) errors.push('Color is invalid');

	// Valid footer
	if (footer) {
		if (typeof footer == 'object') {
			errors.push(getStringErrors(footer.text, 'Footer', true, 2048));

			let res = await checkImage(footer.icon_url, 'Footer icon');
			if (res.kind == 'error') errors.push(res.text);
			if (res.kind == 'warning') warnings.push(res.text);

			if (isStringEmpty(footer.text) && footer.icon_url)
				warnings.push('Footer icon will not be shown without text');
		} else {
			errors.push('Footer is not an object');
		}
	}

	// Valid image
	if (image) {
		if (typeof image == 'object') {
			let res = await checkImage(image.url, 'Image');
			if (res.kind == 'error') errors.push(res.text);
			if (res.kind == 'warning') warnings.push(res.text);
		} else {
			errors.push('Image is not an object');
		}
	}

	// Valid thumbnail
	if (thumbnail) {
		if (typeof thumbnail == 'object') {
			let res = await checkImage(thumbnail.url, 'Thumbnail');
			if (res.kind == 'error') errors.push(res.text);
			if (res.kind == 'warning') warnings.push(res.text);
		} else {
			errors.push('Thumbnail is not an object');
		}
	}

	// Valid author
	if (author) {
		if (typeof author == 'object') {
			errors.push(getStringErrors(author.name, 'Author name', true, 256));
			if (!isValidURL(author.url))
				errors.push('Author has an invalid URL');

			let res = await checkImage(author.icon_url, 'Author icon');
			if (res.kind == 'error') errors.push(res.text);
			if (res.kind == 'warning') warnings.push(res.text);

			if (isStringEmpty(author.name) && (author.url || author.icon_url))
				warnings.push(
					'Author URL and icon will not be shown without a name',
				);
		} else {
			errors.push('Author is not an object');
		}
	}

	// Valid fields
	if (fields && !Array.isArray(fields)) errors.push('Fields is not an array');
	if (fields && fields.length > 25) errors.push('Too many fields (>25)');
	if (fields && Array.isArray(fields))
		fields.forEach((field, index) => {
			if (!field)
				return errors.push(`${ordinal(index + 1)} field is empty`);
			if (typeof field !== 'object')
				return errors.push(
					`${ordinal(index + 1)} field is not an object`,
				);

			errors.push(
				getStringErrors(
					field.name,
					`${ordinal(index + 1)} field's name`,
					false,
					256,
				),
			);
			errors.push(
				getStringErrors(
					field.value,
					`${ordinal(index + 1)} field's value`,
					false,
					1024,
				),
			);

			if (field.inline !== undefined && typeof field.inline !== 'boolean')
				errors.push(
					`${ordinal(index + 1)} field inline is not a boolean`,
				);
		});

	// No content
	if (
		isStringEmpty(title) &&
		isStringEmpty(description) &&
		(!author || isStringEmpty(author.name)) &&
		(!footer || isStringEmpty(footer.text)) &&
		(!fields || fields.length === 0)
	)
		errors.push(
			'No content (title, description, author, footer, or fields).',
		);

	if (data.length > 6000) errors.push('JSON is too long (>6000 characters)');

	Object.keys(json).forEach(key => {
		if (!validKeys.includes(key))
			warnings.push(`"${key}" is not a valid key`);
	});

	errors = errors.filter(x => x !== null);
	warnings = warnings.filter(x => x !== null);

	return {
		warnings,
		errors,
	};
}

/**
 * Check if a string is a valid URL
 * @param {string} url
 * @returns {boolean}
 */
function isValidURL(url) {
	if (!url) return true;
	if (typeof url !== 'string') return false;
	try {
		let urlobj = new URL(url);
		if (!['http:', 'https:'].includes(urlobj.protocol)) return false;
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Check if a string is a valid ISO date
 * @param {string} date
 * @returns {boolean}
 */
function isISODate(date) {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(date);
}

/**
 * Check if a number is a valid decimal color
 * @param {number} color
 * @returns {boolean}
 */
function isValidColor(color) {
	return typeof color == 'number' && color >= 0 && color <= 16777215;
}

/**
 * Add an ordinal suffix to a number
 * @param {number} number
 * @returns {string}
 */
function ordinal(number) {
	const suffixes = ['th', 'st', 'nd', 'rd'];
	const value = number % 100;
	return (
		number + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0])
	);
}

/**
 * Check if string is valid
 * @param {string} string
 * @param {string} prefix Prefix to add to error message
 * @param {boolean = true} allowEmpty Allow empty string
 * @param {string} [maxLength]
 * @returns {string | null}
 */
function getStringErrors(string, prefix, allowEmpty = true, maxLength) {
	if (allowEmpty && !string) return null;
	if (!string || (!allowEmpty && isStringEmpty(string)))
		return `${prefix} is empty`;
	if (typeof string !== 'string') return `${prefix} is not a string`;
	if (maxLength && string.length > maxLength)
		return `${prefix} is too long (>${maxLength} characters)`;
	return null;
}

/**
 * Check if a string is empty (remove whitespace)
 * @param {string} string
 * @returns {boolean}
 */
function isStringEmpty(string) {
	if (!string || typeof string !== 'string') return true;
	return string.replace(/[ \n]/g, '') == '';
}

/**
 * Check if an image is a valid type
 * @async
 * @param {string} url Image URL
 * @param {string = "Image"} prefix Prefix to add to error message
 * @returns {Promise<{text: string | null, kind: "error" | "warning" | null}>} Error
 */
async function checkImage(url, prefix = 'Image') {
	if (!url) return false;
	if (typeof url !== 'string') {
		return {text: `${prefix} is not a string`, kind: 'error'};
	}
	if (!isValidURL(url)) {
		return {text: `${prefix} is not a valid URL`, kind: 'error'};
	}

	let text = null,
		kind = null;

	if (checkedImageLinks.has(url)) {
		({text, kind} = checkedImageLinks.get(url));
	} else {
		const response = await fetch(url).catch(e => null);
		if (!response) {
			text = `could not be checked`;
			kind = 'warning';
		} else if (!response.ok) {
			text = `gave bad response (${response.status} ${response.statusText})`;
			kind = 'warning';
		} else {
			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.startsWith('image/')) {
				text = 'is not an image';
				kind = 'warning';
			} else if (
				![
					'image/png',
					'image/jpeg',
					'image/gif',
					'image/webp',
				].includes(contentType)
			) {
				text = `is an unsupported image type (should be png, jpeg, gif, or webp)`;
				kind = 'warning';
			}
		}
	}

	checkedImageLinks.set(url, {text, kind});
	if (text) text = `${prefix} ${text}`;
	return {text, kind};
}

const input = document.getElementById('input');
const validEl = document.getElementById('valid');
const warningsEl = document.getElementById('warnings');
const errorsEl = document.getElementById('errors');
const warningTextEl = document.getElementById('warningText');
const errorTextEl = document.getElementById('errorText');

input.addEventListener('input', async () => {
	const data = input.value;
	if (input.value.replace(/[ \n]/g, '') == '') {
		validEl.innerHTML = 'Valid:';
		warningsEl.innerHTML = '';
		errorsEl.innerHTML = '';
		return;
	}

	const {valid, warnings, errors} = await checkJSON(data);
	validEl.innerHTML = `Valid: <img id="valid-icon" src="${
		errors.length > 0 ? 'error' : 'ok'
	}.svg">`;
	warningsEl.innerHTML = warnings.map(x => `<li>${x}</li>`).join('\n');
	errorsEl.innerHTML = errors.map(x => `<li>${x}</li>`).join('\n');

	warningTextEl.style.display = warnings.length > 0 ? 'initial' : '';
	errorTextEl.style.display = errors.length > 0 ? 'initial' : '';
});
