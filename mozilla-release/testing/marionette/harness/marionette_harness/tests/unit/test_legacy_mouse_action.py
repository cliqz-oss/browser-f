# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import

import urllib

from marionette_driver.by import By
from marionette_driver.keys import Keys
from marionette_driver.marionette import Actions

from marionette_harness import MarionetteTestCase


def inline(doc):
    return "data:text/html;charset=utf-8,{}".format(urllib.quote(doc))


class BaseLegacyMouseAction(MarionetteTestCase):

    def setUp(self):
        super(BaseLegacyMouseAction, self).setUp()

        if self.marionette.session_capabilities["platformName"] == "darwin":
            self.mod_key = Keys.META
        else:
            self.mod_key = Keys.CONTROL

        self.action = Actions(self.marionette)


class TestLegacyMouseAction(BaseLegacyMouseAction):

    def test_click_action(self):
        test_html = self.marionette.absolute_url("test.html")
        self.marionette.navigate(test_html)
        link = self.marionette.find_element(By.ID, "mozLink")
        self.action.click(link).perform()
        self.assertEqual("Clicked", self.marionette.execute_script(
            "return document.getElementById('mozLink').innerHTML"))

    def test_clicking_element_out_of_view_succeeds(self):
        # The action based click doesn"t check for visibility.
        test_html = self.marionette.absolute_url("hidden.html")
        self.marionette.navigate(test_html)
        el = self.marionette.find_element(By.ID, "child")
        self.action.click(el).perform()

    def test_double_click_action(self):
        self.marionette.navigate(inline("""
          <div contenteditable>zyxw</div><input type="text"/>
        """))

        el = self.marionette.find_element(By.CSS_SELECTOR, "div")
        self.action.double_click(el).perform()
        el.send_keys(self.mod_key + "c")
        rel = self.marionette.find_element(By.CSS_SELECTOR, "input")
        rel.send_keys(self.mod_key + "v")
        self.assertEqual("zyxw", rel.get_property("value"))

    def test_context_click_action(self):
        test_html = self.marionette.absolute_url("clicks.html")
        self.marionette.navigate(test_html)
        click_el = self.marionette.find_element(By.ID, "normal")

        def context_menu_state():
            with self.marionette.using_context("chrome"):
                cm_el = self.marionette.find_element(By.ID, "contentAreaContextMenu")
                return cm_el.get_property("state")

        self.assertEqual("closed", context_menu_state())
        self.action.context_click(click_el).perform()
        self.wait_for_condition(lambda _: context_menu_state() == "open")

        with self.marionette.using_context("chrome"):
            self.marionette.find_element(By.ID, "main-window").send_keys(Keys.ESCAPE)
        self.wait_for_condition(lambda _: context_menu_state() == "closed")

    def test_middle_click_action(self):
        test_html = self.marionette.absolute_url("clicks.html")
        self.marionette.navigate(test_html)

        self.marionette.find_element(By.ID, "addbuttonlistener").click()

        el = self.marionette.find_element(By.ID, "showbutton")
        self.action.middle_click(el).perform()

        self.wait_for_condition(lambda _: el.get_property("innerHTML") == "1")

    def test_chrome_click(self):
        self.marionette.navigate("about:blank")
        data_uri = "data:text/html,<html></html>"
        with self.marionette.using_context("chrome"):
            urlbar = self.marionette.find_element(By.ID, "urlbar")
            urlbar.send_keys(data_uri)
            go_button = self.marionette.execute_script("return gURLBar.goButton")
            self.action.click(go_button).perform()
        self.wait_for_condition(lambda mn: mn.get_url() == data_uri)


class TestChromeLegacyMouseAction(BaseLegacyMouseAction):

    def setUp(self):
        super(TestChromeLegacyMouseAction, self).setUp()

        self.marionette.set_context("chrome")

    def test_chrome_double_click(self):
        test_word = "quux"

        with self.marionette.using_context("content"):
            self.marionette.navigate("about:blank")

        urlbar = self.marionette.find_element(By.ID, "urlbar")
        self.assertEqual("", urlbar.get_property("value"))

        urlbar.send_keys(test_word)
        self.assertEqual(urlbar.get_property("value"), test_word)
        (self.action.double_click(urlbar).perform()
                    .key_down(self.mod_key)
                    .key_down("x").perform())
        self.assertEqual(urlbar.get_property("value"), "")

    def test_chrome_context_click_action(self):
        def context_menu_state():
            cm_el = self.marionette.find_element(By.ID, "tabContextMenu")
            return cm_el.get_property("state")

        currtab = self.marionette.execute_script("return gBrowser.selectedTab")
        self.assertEqual("closed", context_menu_state())
        self.action.context_click(currtab).perform()
        self.wait_for_condition(lambda _: context_menu_state() == "open")

        (self.marionette.find_element(By.ID, "main-window")
                        .send_keys(Keys.ESCAPE))

        self.wait_for_condition(lambda _: context_menu_state() == "closed")
