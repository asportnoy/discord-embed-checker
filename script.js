/**
 * @typedef {Object} CheckResult
 * @property {boolean} valid Is the JSON valid?
 * @property {string[]} warnings A list of warnings
 * @property {string[]} errors A list of errors
 */

/**
 * Check an embed JSON
 * @param {string} data The data as a string
 * @returns {CheckResult}
 */
function checkJSON(data) {
	let json = undefined,
		warnings = [],
		errors = [];
	try {
		json = JSON.parse(data);
	} catch (e) {}

	if (!json)
		return {
			valid: false,
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
	if (footer) errors.push(getStringErrors(footer.text, 'Footer', true, 2048));
	if (footer && !isValidURL(footer.icon_url))
		errors.push('Footer has an invalid icon URL');
	if (footer && isStringEmpty(footer.text) && footer.icon_url)
		warnings.push('Footer icon will not be shown without text');

	// Valid image
	if (image && !isValidURL(image.url))
		errors.push('Image has an invalid URL');

	// Valid thumbnail
	if (thumbnail && !isValidURL(thumbnail.url))
		errors.push('Thumbnail has an invalid URL');

	// Valid author
	if (author)
		errors.push(getStringErrors(author.name, 'Author name', true, 256));
	if (author && !isValidURL(author.url))
		errors.push('Author has an invalid URL');
	if (author && !isValidURL(author.icon_url))
		errors.push('Author has an invalid icon URL');
	if (author && isStringEmpty(author.name) && (author.url || author.icon_url))
		warnings.push('Author URL and icon will not be shown without a name');

	// Valid fields
	if (fields && !Array.isArray(fields)) errors.push('Fields is not an array');
	if (fields && fields.length > 25) errors.push('Too many fields (>25)');
	if (fields && Array.isArray(fields))
		fields.forEach((field, index) => {
			if (!field) errors.push(`${ordinal(index)} field is empty`);

			errors.push(
				getStringErrors(
					field.name,
					`${ordinal(index)} field name`,
					false,
					256,
				),
			);
			errors.push(
				getStringErrors(
					field.value,
					`${ordinal(index)} field value`,
					false,
					1024,
				),
			);

			if (field.inline && typeof field.inline !== 'boolean')
				errors.push(`${ordinal(index)} field inline is not a boolean`);
		});

	// No content
	if (
		isStringEmpty(title) &&
		isStringEmpty(description) &&
		(!author || isStringEmpty(author.name)) &&
		(!footer || isStringEmpty(footer.text)) &&
		!fields &&
		fields.length === 0
	)
		errors.push(
			'No content (title, description, author, footer, or fields).',
		);

	if (data.length > 6000) errors.push('JSON is too long (>6000 characters)');

	errors = errors.filter(x => x !== null);
	warnings = warnings.filter(x => x !== null);

	return {
		valid: errors.length === 0,
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
	if (typeof url !== 'string') return false;
	const pattern = new RegExp(
		'^(https?:\\/\\/)?' + // protocol
			'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
			'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
			'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
			'(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
			'(\\#[-a-z\\d_]*)?$',
		'i',
	); // fragment locator
	return !!pattern.test(url);
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

const input = document.getElementById('input');
const validEl = document.getElementById('valid');
const warningsEl = document.getElementById('warnings');
const errorsEl = document.getElementById('errors');

input.addEventListener('input', () => {
	const data = input.value;
	if (input.value.replace(/[ \n]/g, '') == '') {
		validEl.innerHTML = '';
		warningsEl.innerHTML = '';
		errorsEl.innerHTML = '';
		return;
	}

	const {valid, warnings, errors} = checkJSON(data);
	validEl.innerHTML = valid ? 'Yes' : 'No';
	warningsEl.innerHTML = warnings.map(x => `<li>${x}</li>`).join('\n');
	errorsEl.innerHTML = errors.map(x => `<li>${x}</li>`).join('\n');
});
