"use strict";

(function (ng) {
	"use strict";

	ng.module("angular-autowrap-internal", []);
	ng.module("angular-autowrap", ["angular-autowrap-internal"]);
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap").directive("autowrap", ["autowrapController", "autowrapLinker", function (autowrapController, autowrapLinker) {

		return {
			restrict: "A",
			require: ["?^form", "?ngModel"],
			scope: {
				config: "=autowrapConfig",
				theme: "@autowrapTheme",
				templateFor: "@autowrapTemplateFor",
				validators: "=autowrapValidators"
			},

			controller: ["$scope", function ($scope) {
				autowrapController.init($scope);
			}],

			link: function link(scope, element, attrs, ctrls) {
				autowrapLinker.init(scope, element, attrs, ctrls[0], ctrls[1]);
			}
		};
	}]);
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap").value("autowrapConfig", {
		auto: {
			wrapperClass: "auto-wrapper",
			messageClass: "auto-wrapper-message",
			applyStatesToWrapper: true
		},
		dirtyStateClass: "dirty",
		validStateClass: "valid",
		invalidStateClass: "invalid",
		applyStatesToInput: false,
		noTrack: false
	});
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap-internal").constant("customObjectPropertyPrefix", "autowrapCustom").constant("validationMessagePropertyPrefix", "autowrapMsg").constant("templatePathBase", "autowrap-templates/").constant("defaultTemplateName", "default");
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap-internal").factory("autowrapController", [function () {

		return {
			init: function init($scope) {

				$scope._dirty = false;
				$scope._valid = false;
				$scope._invalid = false;
				$scope._message = "";
				$scope.custom = {};

				$scope.isDirty = function () {
					return $scope._dirty;
				};

				$scope.isValid = function () {
					return $scope._valid;
				};

				$scope.isInvalid = function () {
					return $scope._invalid;
				};

				$scope.validationMessage = function () {
					return $scope._message;
				};
			}
		};
	}]);
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap-internal").factory("autowrapCustomPropertyHelper", ["autowrapUtility", "customObjectPropertyPrefix", function (utility, customObjectPropertyPrefix) {

		return {
			isCustomProperty: function isCustomProperty(attrName) {
				if (!attrName) {
					return false;
				}

				return attrName.indexOf(customObjectPropertyPrefix) === 0 && attrName.length > customObjectPropertyPrefix.length && utility.isUpperCase(attrName.substr(customObjectPropertyPrefix.length, 1));
			},

			getCustomPropertyName: function getCustomPropertyName(attributeName) {
				var prefixLen = customObjectPropertyPrefix.length;
				return ng.lowercase(attributeName[prefixLen]) + attributeName.substr(prefixLen + 1);
			}
		};
	}]);
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap-internal").factory("autowrapLinkerHelper", [function () {

		return {
			getErrorTypes: function getErrorTypes(field) {
				if (!field) {
					return [];
				}

				var props = [];
				ng.forEach(field.$error, function (value, key) {
					if (value) {
						props[props.length] = key;
					}
				});

				return props;
			},

			setWatch: function setWatch(scope, controller, elementName, propertyToWatch, scopeProperty, additionalCallback, callbackContext) {
				scope[scopeProperty] = controller[elementName][propertyToWatch];
				scope.$watch(function () {
					return controller[elementName][propertyToWatch];
				}, function (newVal, oldVal) {
					scope[scopeProperty] = newVal;
					if (typeof additionalCallback === "function") {
						additionalCallback.apply(callbackContext || null, [newVal, oldVal]);
					}
				});
			},

			enableAddingStateClassesToInputElement: function enableAddingStateClassesToInputElement(scope, element, config) {
				scope.$watch(function () {
					if (scope.isDirty()) {
						element.addClass(config.dirtyStateClass);
					} else {
						element.removeClass(config.dirtyStateClass);
					}

					if (scope.isValid()) {
						element.addClass(config.validStateClass);
					} else {
						element.removeClass(config.validStateClass);
					}

					if (scope.isInvalid()) {
						element.addClass(config.invalidStateClass);
					} else {
						element.removeClass(config.invalidStateClass);
					}

					return true;
				});
			}
		};
	}]);
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap-internal").factory("autowrapLinker", ["$compile", "autowrapConfig", "autowrapLinkerHelper", "autowrapCustomPropertyHelper", "autowrapTemplateProvider", "autowrapUtility", "validationMessagePropertyPrefix", function ($compile, providedConfig, linkerHelper, customPropertyHelper, templateProvider, utility, validationMessagePropertyPrefix) {

		return {
			init: function init(scope, element, attrs, formCtrl, modelCtrl) {
				// set custom object properties
				var injectedCustomProperties = {};
				ng.forEach(attrs, function (val, key) {
					if (customPropertyHelper.isCustomProperty(key)) {
						injectedCustomProperties[customPropertyHelper.getCustomPropertyName(key)] = val;
					}
				});
				ng.extend(scope.custom, injectedCustomProperties);

				// transcluding(!)...
				var config = ng.extend({}, providedConfig, scope.config);
				if (ng.isDefined(attrs.autowrapNoTrack)) {
					config.noTrack = true;
				}
				var template = templateProvider.get(scope.templateFor || element[0].tagName, scope.theme);
				var compiledTemplate = ng.element($compile(template)(scope));
				element.after(compiledTemplate);
				var inputPlaceHolder = compiledTemplate.find("placeholder");
				inputPlaceHolder.after(element);
				inputPlaceHolder.remove();

				if (config.noTrack === true) {
					return;
				}

				var elementName = element[0].name;

				// defense
				if (!elementName) {
					throw "The element must have a name attribute for the validation to work.";
				}

				if (formCtrl === null) {
					throw "The element, applied 'autowrap' directive, must be placed inside form (or, ngForm) to work for validation messages." + "\nIf this is not a form element that needs tracking of validation status, just add 'autowrap-no-track' property to the element.";
				}

				if (typeof scope.validators === "object" && utility.hasAnyProperty(scope.validators)) {
					if (modelCtrl === null) {
						throw "To use custom validators with 'autowrap', the element must have ngModel directive applied to it.";
					} else {
						ng.forEach(scope.validators, function (validationFunction, validationName) {
							modelCtrl.$validators[validationName] = validationFunction;
						});
					}
				}

				// set watches
				linkerHelper.setWatch(scope, formCtrl, elementName, "$dirty", "_dirty");

				linkerHelper.setWatch(scope, formCtrl, elementName, "$valid", "_valid", function (valid) {
					if (valid) {
						scope._message = "";
					}
				});

				linkerHelper.setWatch(scope, formCtrl, elementName, "$invalid", "_invalid", function (invalid) {
					if (invalid) {
						var errorTypes = linkerHelper.getErrorTypes(formCtrl[elementName]).map(function (a) {
							return utility.getCamelCasedAttributeName(a, validationMessagePropertyPrefix);
						});

						var availableErrorMessages = utility.filter(errorTypes, function (attributeName) {
							return ng.isDefined(attrs[attributeName]);
						}).map(function (attributeName) {
							return attrs[attributeName];
						});

						scope._message = availableErrorMessages.length ? availableErrorMessages[0] : "Invalid.";
					}
				});

				if (config.applyStatesToInput === true) {
					linkerHelper.enableAddingStateClassesToInputElement(scope, element, config);
				}
			}
		};
	}]);
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap").factory("autowrapTemplateProvider", ["$templateCache", "autowrapConfig", "templatePathBase", "defaultTemplateName", function ($templateCache, config, templatePathBase, defaultTemplateName) {

		var isValidIdentifier = function isValidIdentifier(identifier) {
			return ng.isDefined(identifier) && typeof identifier === "string" && identifier.length;
		};

		var hasTemplate = function hasTemplate(key) {
			var tpl = $templateCache.get(key);
			return isValidIdentifier(tpl);
		};

		var constructTemplateKey = function constructTemplateKey(fieldType, theme) {
			var path = templatePathBase;
			if (isValidIdentifier(theme)) {
				path += theme.toLowerCase() + "/";
			}

			if (isValidIdentifier(fieldType)) {
				path += fieldType.toLowerCase();
			} else {
				path += defaultTemplateName;
			}

			return path + ".html";
		};

		var defaultTemplateKey = constructTemplateKey(void 0, void 0);
		var stateClasses = "data-ng-class=\"{'" + config.dirtyStateClass + "': isDirty(), '" + config.validStateClass + "': isValid(), '" + config.invalidStateClass + "': isInvalid()}\"";
		var defaultTemplate = "<div class=\"" + config.auto.wrapperClass + "\" " + (config.auto.applyStatesToWrapper ? stateClasses : "") + ">" + "<placeholder />" + "<span class=\"" + config.auto.messageClass + "\">{{validationMessage()}}</span>" + "</div>";

		$templateCache.put(defaultTemplateKey, defaultTemplate);

		return {
			get: function get(fieldType, theme) {
				var field = isValidIdentifier(fieldType) ? fieldType : void 0;
				var themeName = isValidIdentifier(theme) ? theme : void 0;

				var keys = [constructTemplateKey(field, themeName), // check for field template of the theme
				constructTemplateKey(void 0, themeName), // check for default template of the theme
				constructTemplateKey(field, void 0), // check for field template of the default theme
				constructTemplateKey(void 0, void 0) // check for default template of default theme
				];

				for (var i = 0; i < keys.length; i++) {
					if (hasTemplate(keys[i])) {
						return $templateCache.get(keys[i]);
					}
				}

				return defaultTemplate;
			},

			put: function put(template, fieldType, theme) {
				if (!template) {
					return;
				}

				var key = constructTemplateKey(fieldType, theme);
				$templateCache.put(key, template);
			}
		};
	}]);
})(angular);

(function (ng) {
	"use strict";

	ng.module("angular-autowrap-internal").factory("autowrapUtility", ["$filter", function ($filter) {
		return {

			filter: function filter(array, expression, comparator) {
				return $filter("filter")(array, expression, comparator);
			},

			getCamelCasedAttributeName: function getCamelCasedAttributeName(dashedAttributeName, prefix) {
				if (!dashedAttributeName) {
					return dashedAttributeName;
				}

				var prop = dashedAttributeName.split("-").map(function (x) {
					return ng.uppercase(x.substring(0, 1)) + x.substring(1);
				}).join("");

				if (prefix) {
					return prefix + prop;
				}

				return ng.lowercase(prop[0]) + prop.substring(1);
			},

			isUpperCase: function isUpperCase(str) {
				if (!str) {
					return false;
				}

				return ng.uppercase(str) === str;
			},

			hasAnyProperty: function hasAnyProperty(obj) {
				if (!obj) {
					return false;
				}

				for (var prop in obj) {
					if (obj.hasOwnProperty(prop)) {
						return true;
					}
				}

				return false;
			}
		};
	}]);
})(angular);